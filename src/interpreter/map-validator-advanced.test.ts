import {
  isMapDocumentNode,
  MapASTNode,
  ProfileDocumentNode,
} from '@superfaceai/ast';

import { parseMap, parseProfile, Source } from '..';
import { ProfileOutput, ValidationIssue } from '.';
import { formatIssues, getProfileOutput, validateMap } from './utils';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeValidMap(
        profileOutput: ProfileOutput,
        warning: string,
        error?: string
      ): R;
    }
  }
}

expect.extend({
  toBeValidMap(
    map: MapASTNode,
    profileOutput: ProfileOutput,
    warning: string,
    error?: string
  ) {
    const result = validateMap(profileOutput, map);

    let message = '';
    let pass = true;
    let errors: ValidationIssue[] = [];
    let warnings: ValidationIssue[] = [];

    if (!result.pass) {
      errors = result.errors;
    }
    if (result.warnings && result.warnings.length > 0) {
      warnings = result.warnings;
    }

    if (this.isNot) {
      pass = false;

      if (!error) {
        pass = !pass;
        message = 'expected to fail';
      } else {
        const err = formatIssues(errors);
        const warn = formatIssues(warnings);

        if (!err.includes(error)) {
          pass = !pass;
          message = `expected to find error "${error}" in "${err}"`;
          if (warning !== '' && !warn.includes(warning)) {
            message += `, expected to find warning "${warning}" in "${warn}"`;
          }
        } else if (warning !== '' && !warn.includes(warning)) {
          pass = !pass;
          message = `expected to find warning "${warning}" in "${warn}"`;
        }
      }
    } else {
      const warn = formatIssues(warnings);
      const err = formatIssues(errors);
      if (errors.length > 0) {
        pass = !pass;
        message = `expected to pass, errors: ${err}, warnings: ${warn}`;
      } else if (warning && warning !== '' && !warn.includes(warning)) {
        pass = !pass;
        message = `expected to find warning "${warning}" in "${warn}"`;
      }
    }

    return {
      pass,
      message: (): string => message,
    };
  },
});

function validWithWarnings(
  profile: ProfileDocumentNode,
  maps: MapASTNode[],
  ...warnings: string[]
): void {
  const profileOutput = getProfileOutput(profile);

  it('then validation will pass with warnings', () => {
    maps.forEach((map, index) => {
      expect(map).toBeValidMap(profileOutput, warnings[index]);
    });
  });
}

function invalidWithErrors(
  profile: ProfileDocumentNode,
  maps: MapASTNode[],
  ...results: string[]
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

function getIssues(profile: ProfileDocumentNode, maps: MapASTNode[]) {
  const profileOutput = getProfileOutput(profile);
  const output: Record<string, { errors?: string; warnings?: string }> = {};
  let id: string | undefined;

  for (const map of maps) {
    if (isMapDocumentNode(map)) {
      id = `${map.header.profile.name}-${map.header.provider}`;
    }

    const result = validateMap(profileOutput, map);
    const issues: { errors?: string; warnings?: string } = {};

    if (!result.pass) {
      issues.errors = formatIssues(result.errors);
    }

    if (result.warnings && result.warnings.length > 0) {
      issues.warnings = formatIssues(result.warnings);
    }

    if (id === undefined) {
      throw new Error('unreachable');
    }

    output[id] = issues;
  }

  return output;
}

function valid(profile: ProfileDocumentNode, maps: MapASTNode[]): void {
  it('then validation will pass', () => {
    expect(getIssues(profile, maps)).toMatchSnapshot();
  });
}

function invalid(profile: ProfileDocumentNode, maps: MapASTNode[]): void {
  it('then validation will fail', () => {
    expect(getIssues(profile, maps)).toMatchSnapshot();
  });
}

const parseMapFromSource = (source: string): MapASTNode =>
  parseMap(
    new Source(
      `
      profile = "profile@1.0"
      provider = "provider"
      ` + source
    )
  );

const parseProfileFromSource = (source: string): ProfileDocumentNode =>
  parseProfile(
    new Source(
      `
      name = "profile"
      version = "1.0.0"
      ` + source
    )
  );

describe('MapValidatorAdvanced', () => {
  describe('combination of input, result & error', () => {
    describe('nested', () => {
      const profileAst = parseProfileFromSource(
        `field status string
        field deliveryStatus enum {
          accepted
          delivered
          seen
        }
        
        usecase Test {
          input {
            person {
              to! string!
              from! string!
            }
            text string!
          }
          
          result {
            status
            messageID number
          }

          async result {
            messageId
            deliveryStatus
          }

          error enum { 
            INVALID_CHARACTER
            INVALID_PERSON
          }
          
        }`
      );
      const mapAst1 = parseMapFromSource(
        `map Test {
          http POST "http://www.example.com/" {
            request {
              body {
                to = input.person.to
                sms.from = input.person.from
                sms.text = input.text
              }
            }
        
            response 200 {
              map result if (input.text) {
                status = "OK"
              }
        
              map error if (!input.person.from) "PERSON_NOT_FOUND"
            }
          }
        }`
      );
      const mapAst2 = parseMapFromSource(
        `map Test {
          http POST "http://www.example.com/" {
            request {
              body {
                to = input.person.to
                sms.from = input.wrong
                sms.text = input.so.wrong
              }
            }
        
            response 200 {
              map result {
                messageID = 1
              }
            }
        
            response 404 {
              map error if (!input.person.from) "NOT_FOUND"
            }
          }
        }`
      );
      const mapAst3 = parseMapFromSource(
        `map Test {
          http POST "http://www.example.com/" {
            request {
              body {
                to = input.person.to
                sms.from = input.person.from
                sms.text = input.text
              }
            }
        
            response 200 {
              map result {
                status = input.text
                messageID = 1
              }
            }
        
            response 404 {
              map error "NOT_FOUND"
            }
          }
        }`
      );

      valid(profileAst, [mapAst1]);
      invalid(profileAst, [mapAst2, mapAst3]);
    });

    describe('Send Message usecase', () => {
      const profileAst = parseProfileFromSource(
        `usecase SendMessage unsafe {
          input {
            to string
            from string
            text string 
          }

          result {
            messageId
          }

          async result {
            messageId
            deliveryStatus
          }

          error {
            problem string
            detail string
            instance string
          }
        }

        field messageId string

        field deliveryStatus enum {
          accepted
          delivered
          seen
        }`
      );
      const mapAst1 = parseMapFromSource(
        `map SendMessage {
          http POST "http://www.example.com/" {
            request {
              body {
                sms.to = input.to
                sms.from = input.from
                sms.text = input.text
              }
            }
        
            response 200 {
              map error if (!input.person) {
                problem = "Person not found."
              }
        
              map result {
                deliveryStatus = "accepted"
                messageID = 1
              }
            }
        
            response 200 {
              map error if (!input.person) {
                problem = "Person not found."
              }
        
              map result if (input.text) {
                deliveryStatus = "seen"
                messageID = 1
              }
            }
          }
        }`
      );
      const mapAst2 = parseMapFromSource(
        `map SendMessage {
          http POST "http://www.example.com/{input.channel}" {
            request {
              body {
                sms.to = input.is.wrong
                sms.from = input.from
                sms.text = input.person
              }
            }
        
            response 200 {
              map error if (!input.some.person) {
                some.key = "some error outcome"
              }
        
              map result {
                deliveryStatus = {
                }
                messageID = false
              }
            }
        
            response 200 {
              map error if (!input.person) {
                status = "ERROR."
                statusID = "1"
              }
        
              map result if (input.text) {
                status = "OK."
                messageID = false
              }
            }
          }
        }`
      );
      const mapAst3 = parseMapFromSource(
        `map SendMessage {
          http POST "http://www.example.com/{input.channel}" {
            request {
              body {
                sms.to = input.is.wrong
                sms.from = input.very.very.wrong
              }
            }
        
            response 200 {
              map error {
                some.key = "some error outcome"
              }
        
              map result if (!input.some.person) {
                deliveryStatus = {
                }
                messageID = false
              }
            }
        
            response 200 {
              map error {
                status = "ERROR."
                statusID = "1"
              }
        
              map result {
                status = "OK."
                messageID = false
              }
            }
          }
        }`
      );

      validWithWarnings(
        profileAst,
        [mapAst1],
        `19:26 ObjectLiteral - Wrong Object Structure: expected messageId, but got deliveryStatus, messageID
30:42 ObjectLiteral - Wrong Object Structure: expected messageId, but got deliveryStatus, messageID`
      );
      invalidWithErrors(
        profileAst,
        [mapAst2, mapAst3],
        `5:11 HttpCallStatement - Wrong Input Structure: expected to, from, text, but got input.channel
8:26 JessieExpression - Wrong Input Structure: expected to, from, text, but got input.is.wrong
8:26 PropertyAccessExpression - Wrong Input Structure: expected to, from, text, but got input.is.wrong
10:28 JessieExpression - Wrong Input Structure: expected to, from, text, but got input.person
10:28 PropertyAccessExpression - Wrong Input Structure: expected to, from, text, but got input.person`,
        `15:49 ObjectLiteral - Wrong Object Structure: expected problem, detail, instance, but got some.key
19:26 ObjectLiteral - Wrong Object Structure: expected messageId, but got deliveryStatus, messageID
27:44 ObjectLiteral - Wrong Object Structure: expected problem, detail, instance, but got status, statusID
32:42 ObjectLiteral - Wrong Object Structure: expected messageId, but got status, messageID`,
        `5:11 HttpCallStatement - Wrong Input Structure: expected to, from, text, but got input.channel
8:26 JessieExpression - Wrong Input Structure: expected to, from, text, but got input.is.wrong
8:26 PropertyAccessExpression - Wrong Input Structure: expected to, from, text, but got input.is.wrong
9:28 JessieExpression - Wrong Input Structure: expected to, from, text, but got input.very.very.wrong
9:28 PropertyAccessExpression - Wrong Input Structure: expected to, from, text, but got input.very.very.wrong`,
        `14:25 ObjectLiteral - Wrong Object Structure: expected problem, detail, instance, but got some.key
18:50 ObjectLiteral - Wrong Object Structure: expected messageId, but got deliveryStatus, messageID
26:25 ObjectLiteral - Wrong Object Structure: expected problem, detail, instance, but got status, statusID
31:26 ObjectLiteral - Wrong Object Structure: expected messageId, but got status, messageID`
      );
    });

    describe('Send Message usecase with any structures', () => {
      const profileAst = parseProfileFromSource(
        `usecase SendMessage unsafe {
          input {
            to 
            from 
            text
          }

          result {
            messageId
          }

          async result {
            messageId
            deliveryStatus
          }

          error {
            problem 
            detail 
            instance 
          }
        }

        field messageId string

        field deliveryStatus enum {
          accepted
          delivered
          seen
        }`
      );
      const mapAst1 = parseMapFromSource(
        `map SendMessage {
          http POST "http://www.example.com/" {
            request {
              body {
                sms.to = input.to
                sms.from = input.from
                sms.text = input.text
              }
            }
        
            response 200 {
              map error if (!input.person) {
                problem = "Person not found."
              }
        
              map result {
                deliveryStatus = "accepted"
                messageID = 1
              }
            }
        
            response 200 {
              map error if (!input.person) {
                problem = "Person not found."
              }
        
              map result if (input.text) {
                deliveryStatus = "seen"
                messageID = 1
              }
            }
          }
        }`
      );
      const mapAst2 = parseMapFromSource(
        `map SendMessage {
          http POST "http://www.example.com/" {
            request {
              body {
                sms.to = input.to
                sms.from = input.from
                sms.text = input.text
              }
            }
        
            response 200 {
              map error {
                problem.problemID = 1
                problem.description = "some error outcome"
              }
            }
        
            response 200 {
              map error if (!input.text) {
                problem = "ERROR."
                detail = "1"
              }
        
              map result if (input.text) {
                deliveryStatus = "accepted"
                messageID = 1
              }
            }
          }
        }`
      );
      const mapAst3 = parseMapFromSource(
        `map SendMessage {
          http POST "http://www.example.com/" {
            request {
              body {
                sms.to = input.is.wrong
                sms.from = input.very.very.wrong
              }
            }
        
            response 200 {
              map error {
                some.key = "some error outcome"
              }
        
              map result if (!input.some.person) {
                messageID = false
              }
            }
        
            response 200 {
              map error {
                status = "ERROR."
                statusID = "1"
              }
        
              map result {
                status = "OK."
                messageID = false
              }
        
              map error {
                status = "ERROR."
                statusID = "1"
              }
        
              map result {
                status = "OK."
                messageID = false
              }
            }
          }
        }`
      );

      validWithWarnings(
        profileAst,
        [mapAst1, mapAst2],
        `19:26 ObjectLiteral - Wrong Object Structure: expected messageId, but got deliveryStatus, messageID
30:42 ObjectLiteral - Wrong Object Structure: expected messageId, but got deliveryStatus, messageID`
      );
      invalidWithErrors(
        profileAst,
        [mapAst3],
        `8:26 JessieExpression - Wrong Input Structure: expected to, from, text, but got input.is.wrong
8:26 PropertyAccessExpression - Wrong Input Structure: expected to, from, text, but got input.is.wrong
9:28 JessieExpression - Wrong Input Structure: expected to, from, text, but got input.very.very.wrong
9:28 PropertyAccessExpression - Wrong Input Structure: expected to, from, text, but got input.very.very.wrong`,
        `14:25 ObjectLiteral - Wrong Object Structure: expected problem, detail, instance, but got some.key
18:50 ObjectLiteral - Wrong Object Structure: expected messageId, but got messageID
24:25 ObjectLiteral - Wrong Object Structure: expected problem, detail, instance, but got status, statusID
29:26 ObjectLiteral - Wrong Object Structure: expected messageId, but got status, messageID
34:25 ObjectLiteral - Wrong Object Structure: expected problem, detail, instance, but got status, statusID
39:26 ObjectLiteral - Wrong Object Structure: expected messageId, but got status, messageID`
      );
    });

    describe('Retrieve Message Status usecase', () => {
      const profileAst = parseProfileFromSource(
        `usecase RetrieveMessageStatus safe {
          input {
            messageId
          }
  
          result {
            deliveryStatus
          }
        }
  
        field messageId string
  
        field deliveryStatus enum {
          accepted
          delivered
          seen
        }`
      );
      const mapAst1 = parseMapFromSource(
        `map RetrieveMessageStatus {
          http POST "http://www.example.com/" {
            request "application/json" {
              body {
                sms.messageId = input.messageId
              }
            }
        
            response 200 {
              map result {
                deliveryStatus = "seen"
              }
            }
        
            response 300 {
              map result {
                deliveryStatus = "accepted"
              }
            }
          }
        }`
      );
      const mapAst2 = parseMapFromSource(
        `map RetrieveMessageStatus {
          http POST "http://www.example.com/" {
            request "application/json" {
              body {
                sms.messageId = input.wrong.key.in.input
                some.body = body.sid
                sms.to = input.to
              }
            }
        
            response 200 {
              map error {
                some.key = true
              }
        
              map result {
                status = "OK"
                some.key = true
              }
            }
        
            response 300 {
              map result {
                status = "OK"
              }
            }
          }
        }`
      );

      validWithWarnings(profileAst, [mapAst1], '');
      invalidWithErrors(
        profileAst,
        [mapAst2],
        `8:33 JessieExpression - Wrong Input Structure: expected messageId, but got input.wrong.key.in.input
8:33 PropertyAccessExpression - Wrong Input Structure: expected messageId, but got input.wrong.key.in.input
10:26 JessieExpression - Wrong Input Structure: expected messageId, but got input.to
10:26 PropertyAccessExpression - Wrong Input Structure: expected messageId, but got input.to`,
        ''
      );
    });

    describe('swapi get character information', () => {
      const profileAst = parseProfileFromSource(
        `usecase RetrieveCharacterInformation safe {
          input {
            characterName
          }
        
          result {
            height
            weight
            yearOfBirth
          }
        
          error {
            message
            characters
          }
        }
        
        field characterName string
        field height string
        field weight string
        field yearOfBirth string
        field message string
        field characters [string]`
      );

      const mapAst = parseMapFromSource(
        `map RetrieveCharacterInformation {
          http GET "/people/" {
            request {
              query {
                search = input.characterName
              }
            }
        
            response 200 "application/json" {
              return map error if (body.count === 0) {
                message = "No character found"
              }
        
              entries = body.results.filter(result => result.name.toLowerCase() === input.characterName.toLowerCase())
        
              return map error if (entries.length === 0) {
                message = "Specified character name is incorrect, did you mean to enter one of following?"
                characters = body.results.map(result => result.name)
              }
        
              character = entries[0]
        
              map result {
                height = character.height
                weight = character.mass
                yearOfBirth = character.birth_year
              }
            }
          }
        }`
      );

      valid(profileAst, [mapAst]);
    });

    describe('validating binary expression', () => {
      const profileAst = parseProfileFromSource(
        `
        usecase UpdateTemplate unsafe {
          input {
            name
            subject
            text
            html
          }
        
          result Template
        }
        
        model Template {
          id
          name
        }
      `
      );

      const mapAst = parseMapFromSource(
        `
        map UpdateTemplate {
          template = { text: "text", html: "html", id: "id", name: "name"}
        
          subject = input.subject || template.subject
          text = input.text || template.text
          html = input.html || template.html
        
          map result {
            id = template.id
            name = template.name
          }
        }
        `
      );

      valid(profileAst, [mapAst]);
    });
  });
});
