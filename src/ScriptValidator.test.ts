import { SuperfaceScriptValidator } from "./ScriptValidator";

describe("ScriptValidator", () => {
  let validator!: SuperfaceScriptValidator;

  beforeEach(() => {
    validator = new SuperfaceScriptValidator();
  });

  describe("ForbidenConstructs", () => {
    it("new keyword", () => {
      validator.validate("new Array()");
      expect(validator.report.isValid).toEqual(false);
      expect(validator.report.errors[0].message).toContain(
        "NewExpression construct is not supported"
      );
    });

    it("function keyword", () => {
      validator.validate("function foo(){}");
      expect(validator.report.isValid).toEqual(false);
      expect(validator.report.errors[0].message).toContain(
        "FunctionDeclaration construct is not supported"
      );
    });

    it("var keyword", () => {
      validator.validate("var x = 45");
      expect(validator.report.isValid).toEqual(false);
      //console.log(validator.report.errors);
      expect(validator.report.errors[0].hint).toContain("Use let");
    });
  });

  describe("Valid scripts", () => {
    it("let", () => {
      validator.validate("let x = 43");
      expect(validator.report.isValid).toEqual(true);
    });

    it("const", () => {
      validator.validate("const x = 43");
      expect(validator.report.isValid).toEqual(true);
    });

    it("Math expression", () => {
      validator.validate("1 + 3 * 25");
      expect(validator.report.isValid).toEqual(true);
    });

    it("arrow function", () => {
      validator.validate("const foo = (x) => {return 1;}");
      expect(validator.report.isValid).toEqual(true);
    });
  });
});
