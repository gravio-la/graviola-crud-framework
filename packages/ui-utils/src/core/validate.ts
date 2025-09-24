import Ajv, { ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import { $Validator, wrapValidatorAsTypeGuard } from "json-schema-to-ts";

const ajv = new Ajv();
addFormats(ajv);

const $validate: $Validator = (schema, data) => ajv.validate(schema, data);

export const validate = wrapValidatorAsTypeGuard($validate);

export const validateWithAjv: (
  schema: any,
  data: any,
) => {
  isValid: boolean;
  errors: ErrorObject[];
} = (schema: any, data: any) => {
  const validateSchema = ajv.compile(schema);
  const isValid = validateSchema(data);
  return {
    isValid,
    errors: validateSchema.errors,
  };
};
