﻿/// <reference path="base.ts" />
module dxSurvey {

    export class JsonObjectProperty {
        public className: string = null;
        public onGetValue: (obj: any) => any = null;
        public onSetValue: (obj: any, value: any) => any

        constructor(public name: string) {
        }
        public get hasToUseGetValue() { return this.onGetValue; }
        public getValue(obj: any): any {
            if (this.onGetValue) return this.onGetValue(obj);
            return null;
        }
        public get hasToUseSetValue() { return this.onSetValue; }
        public setValue(obj: any, value: any) {
            if (this.onSetValue) {
                this.onSetValue(obj, value);
            }
        }
    }
    class JsonMetadataClass {
        properties: Array<JsonObjectProperty> = null;
        constructor(public name: string, propertiesNames: Array<string>, public creator: () => any = null, public parentName: string = null) {
            this.properties = new Array<JsonObjectProperty>();
            for (var i = 0; i < propertiesNames.length; i++) {
                this.properties.push(new JsonObjectProperty(propertiesNames[i]));
            }
        }
        public find(name: string): JsonObjectProperty {
            for (var i = 0; i < this.properties.length; i++) {
                if (this.properties[i].name == name) return this.properties[i];
            }
            return null;
        }

    }
    export class JsonMetadata {
        private classes: HashTable<JsonMetadataClass> = {};
        private classProperties: HashTable<Array<JsonObjectProperty>> = {};
        public addClass(name: string, propertiesNames: Array<string>, creator: () => any = null, parentName: string = null): JsonMetadataClass {
            var metaDataClass = new JsonMetadataClass(name, propertiesNames, creator, parentName);
            this.classes[name] = metaDataClass;
            return metaDataClass;
        }
        public setCreator(name: string, creator: () => any) {
            var metaDataClass = this.classes[name];
            if (!metaDataClass) return;
            metaDataClass.creator = creator;
        }
        public setPropertyValues(name: string, propertyName: string, propertyClassName: string, onGetValue: (obj: any) => any = null, onSetValue: (obj: any, value: any) => any = null) {
            var property = this.findProperty(name, propertyName);
            if (!property) return;
            property.className = propertyClassName;
            property.onGetValue = onGetValue;
            property.onSetValue = onSetValue;
        }
        public getProperties(name: string): Array<JsonObjectProperty> {
            var properties = this.classProperties[name];
            if (!properties) {
                properties = new Array<JsonObjectProperty>();
                this.fillProperties(name, properties);
                this.classProperties[name] = properties;
            }
            return properties;
        }
        public createClass(name: string): any {
            var metaDataClass = this.classes[name];
            if (!metaDataClass) return null;
            return metaDataClass.creator();
        }
        private findProperty(name: string, propertyName: string): JsonObjectProperty {
            var metaDataClass = this.classes[name];
            return metaDataClass ? metaDataClass.find(propertyName) : null;
        }
        private fillProperties(name: string, list: Array<JsonObjectProperty>) {
            var metaDataClass = this.classes[name];
            if (!metaDataClass) return;
            if (metaDataClass.parentName) {
                this.fillProperties(metaDataClass.parentName, list);
            }
            for (var i = 0; i < metaDataClass.properties.length; i++) {
                this.addProperty(metaDataClass.properties[i], list, list.length);
            }
        }
        private addProperty(property: JsonObjectProperty, list: Array<JsonObjectProperty>, endIndex: number) {
            var index = -1;
            for (var i = 0; i < endIndex; i++) {
                if (list[i].name == property.name) {
                    index = i;
                    break;
                }
            } 
            if (index < 0) {
                list.push(property)
            } else {
                list[index] = property;
            }
        }
    }
    export class JsonObject {
        private static typePropertyName = "type";
        private static metaDataValue = new JsonMetadata();
        public static get metaData() { return JsonObject.metaDataValue; }
        public toJsonObject(obj: any): any {
            return this.toJsonObjectCore(obj, null);
        }
        public toObject(jsonObj: any, obj: any) {
            if (!jsonObj) return;
            var properties = null;
            if (obj.getType) {
                properties = JsonObject.metaData.getProperties(obj.getType());
            }
            for (var key in jsonObj) {
                this.valueToObj(jsonObj[key], obj, key, this.findProperty(properties, key));
            }
        }
        protected toJsonObjectCore(obj: any, property: JsonObjectProperty): any {
            if (!obj.getType) return obj;
            var result = {};
            if (property != null && (!property.className)) {
                result[JsonObject.typePropertyName] = obj.getType();
            }
            var properties = JsonObject.metaData.getProperties(obj.getType());
            for (var i: number = 0; i < properties.length; i++) {
                this.valueToJson(obj, result, properties[i]);
            }
            return result;
        }
        protected valueToJson(obj: any, result: any, property: JsonObjectProperty) {
            var value = null;
            if (property.hasToUseGetValue) {
                value = property.getValue(obj);
            } else {
                value = obj[property.name];
            }
            if (!value) return;
            if (this.isValueArray(value)) {
                var arrValue = [];
                for (var i = 0; i < value.length; i++) {
                    arrValue.push(this.toJsonObjectCore(value[i], property));
                }
                value = arrValue.length > 0 ? arrValue : null;
            } else {
                value = this.toJsonObjectCore(value, property);
            }
            if (value) {
                result[property.name] = value;
            }
        }
        protected valueToObj(value: any, obj: any, key: any, property: JsonObjectProperty) {
            if (property != null && property.hasToUseSetValue) {
                property.setValue(obj, value);
                return;
            }
            if (this.isValueArray(value)) {
                this.valueToArray(value, obj, key, property);
                return;
            } 
            var newObj = this.createNewObj(value, property);
            if (newObj) {
                this.toObject(value, newObj);
                value = newObj;
            } 
            obj[key] = value;
        }
        private isValueArray(value: any): boolean { return value.constructor.toString().indexOf("Array") > -1; }
        private createNewObj(value: any, property: JsonObjectProperty): any {
            var className = value[JsonObject.typePropertyName];
            if (className) {
                delete value[JsonObject.typePropertyName];
            } else {
                if (property != null && property.className) {
                    className = property.className;
                }
            }
            return (className) ? JsonObject.metaData.createClass(className) : null;
        }
        private valueToArray(value: Array<any>, obj: any, key: any, property: JsonObjectProperty) {
            if (!this.isValueArray(obj[key])) {
                obj[key] = [];
            }
            for (var i = 0; i < value.length; i++) {
                var newValue = this.createNewObj(value[i], property);
                if (newValue) {
                    obj[key].push(newValue);
                    this.toObject(value[i], newValue);
                } else {
                    obj[key].push(value[i]);
                }
            }
        }
        private findProperty(properties: Array<JsonObjectProperty>, key: any): JsonObjectProperty {
            if (!properties) return null;
            for (var i = 0; i < properties.length; i++) {
                if (properties[i].name == key) return properties[i];
            }
            return null;
        }
    }
}