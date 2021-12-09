import {
  MapASTNode,
  ProfileASTNode,
  ProfileDocumentNode,
} from '@superfaceai/ast';

import {
  formatIssues,
  getProfileOutput,
  ProfileOutput,
  validateMap,
  ValidationIssue,
  ValidationResult,
} from '..';
import { ExamplesValidator } from '../example-validator';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeValidMap(
        profileOutput: ProfileOutput,
        warnings?: string[],
        errors?: string[]
      ): R;
      toBeValidExample(errors?: string[], warnings?: string[]): R;
    }
  }
}

interface Options {
  result: ValidationResult;
  issues: { errors: ValidationIssue[]; warnings: ValidationIssue[] };
  errors?: string[];
  warnings?: string[];
}

interface TestResult {
  pass: boolean;
  message: () => string;
}

function isNotValid({ result, issues, errors, warnings }: Options): TestResult {
  let pass = false,
    message = '';

  if (!errors) {
    return {
      pass: !pass,
      message: () => 'Expected to fail, specify the errors',
    };
  }

  if (result.pass || result.errors.length === 0) {
    return {
      pass: !pass,
      message: () => 'Expected to fail, specified map is valid',
    };
  }

  const err = formatIssues(issues.errors);
  const warn = formatIssues(issues.warnings);

  message = 'Expected to find errors:\n';

  for (const error of errors) {
    if (!err.includes(error)) {
      if (!pass) {
        pass = true;
      }

      message += `"${error}"\n`;
    }
  }

  message += `in original errors:\n"${err}"\n`;

  if (warnings && warnings.length > 0) {
    message += '\nExpected to find warnings:\n';

    for (const warning of warnings) {
      if (!warn.includes(warning)) {
        if (!pass) {
          pass = true;
        }

        message += `"${warning}"\n`;
      }
    }

    message += `in original warnings:\n"${warn}"\n`;
  }

  return {
    pass,
    message: () => message,
  };
}

function isValid({ result, issues, warnings }: Options): TestResult {
  const warn = formatIssues(issues.warnings);
  const err = formatIssues(issues.errors);
  let pass = true,
    message = '';

  if (!result.pass && result.errors.length > 0) {
    return {
      pass: !pass,
      message: () =>
        `Expected to pass, specified map is invalid.\nErrors:\n${err}\nWarnings:\n${warn}\n`,
    };
  }

  if (warnings && warnings.length > 0) {
    message += 'Expected to find warnings:\n';

    for (const warning of warnings) {
      if (!warn.includes(warning)) {
        if (pass) {
          pass = false;
        }

        message += `"${warning}"\n`;
      }
    }

    message += `in original warnings:\n"${warn}"\n`;
  }

  return {
    pass,
    message: () => message,
  };
}

expect.extend({
  toBeValidMap(
    map: MapASTNode,
    profileOutput: ProfileOutput,
    warnings?: string[],
    errors?: string[]
  ) {
    const result = validateMap(profileOutput, map);

    const issues = {
      errors: !result.pass ? result.errors : [],
      warnings: result.warnings ?? [],
    };

    if (this.isNot) {
      return isNotValid({ result, issues, errors, warnings });
    }

    return isValid({ result, issues, errors, warnings });
  },
  toBeValidExample(
    profile: ProfileASTNode,
    errors?: string[],
    warnings?: string[]
  ) {
    const exampleValidator = new ExamplesValidator(profile);
    const result = exampleValidator.validate();

    const issues = {
      errors: !result.pass ? result.errors : [],
      warnings: result.warnings ?? [],
    };

    if (this.isNot) {
      return isNotValid({ result, issues, errors, warnings });
    }

    return isValid({ result, issues, errors, warnings });
  },
});

// eslint-disable-next-line jest/no-export
export function validWithWarnings(
  profile: ProfileDocumentNode,
  maps: MapASTNode[],
  ...warnings: string[][]
): void {
  const profileOutput = getProfileOutput(profile);

  it('then validation will pass with warnings', () => {
    maps.forEach((map, index) => {
      expect(map).toBeValidMap(profileOutput, warnings[index]);
    });
  });
}

// eslint-disable-next-line jest/no-export
export function invalidWithErrors(
  profile: ProfileDocumentNode,
  maps: MapASTNode[],
  ...results: string[][]
): void {
  const profileOutput = getProfileOutput(profile);

  it('then validation will fail with errors', () => {
    let i = 0;
    maps.forEach(map => {
      expect(map).not.toBeValidMap(profileOutput, results[i + 1], results[i]);
      i += 2;
    });
  });
}
