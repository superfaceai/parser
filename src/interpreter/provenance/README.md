# Provenance analyzer

The provenance analyzer tracks the provenance (history, source, origin) of items in maps. The job of provenance analyzer is to provide a clear answer to the question "where does this item come from?". This means a provenance analyzer can track the chain of operations from a map input all the way to map results, including values sourced from HTTP calls, literals or context parameters.

## Sources

The sources of values are the roots of all provenance chains. There are:

- literals - intialized directly in the code
- input - entering into maps through the `input` object, the fields are defined in the profile
- context parameters - entering into maps through the `parameters` object, the fields are defined in provider definition
- http response - entering into maps through HTTP call responses, their types are mostly unknown and may only be guessed

## Item operations

Operations on items change their provenance. Operations can perform almost any function, for example a "not" operation, "logical or" operation or a "conditional if-then" operation. Item operations are the most complex category as they have to cover every available operation in maps and script.

### Item composition

Items can compose into structures and the provenance of individual items must persist. Thsi means objects and arrays composed of several items must persist the keys to access these items and the provenance of each item separately. Item composition is also defined as an operation, but mentioned explicitly for clarity.

## Complex example

```
// provenance: a is a literal (1)
a = 1

// provenance: b is unary operation (not) on a literal (1) resulting in "not <first>"
b = !a

// provenance: c is binary operation (logical or) on:
//   a literal (1) and
//   an unary operation (not) on a literal (1)
//   resulting in "<first> or <second>"
c = a || b

// provenance: d is a literal ("hi")
d = "hi"
// provenance: d is a literal ("hello") (and overrides the previous value unconditionally)
d = "hello"

set if (a === undefined) {
	// provenance: d is a binary operation (conditional override) on:
	//   a binary operation (equals) on a literal (1) and a literal (undefined) and
	//   a literal (true) and
	//   a literal ("hello")
	//   resulting in "if <first> then <second> else <third>"
	d = true
}

// provenance: e is binary operation (composition) on:
//    a literal (1) with key "f1" and
//    a composition of
//      an unary operation (not) on a literal (1) with key "0" and
//      a binary operation (logical or) on a literal (1) and an unary operation (not) on a literal (1) with key "1"
//    with key "f2"
e = { f1: a, f2: [b, c] }

// provenance: f is a binary operation (call) on:
//    a literal ("Foo") and
//    a composition of
//      a literal (1) with key "arg1" and
//      an unary operation (not) on a literal (1) with key "arg2" and
//      a literal (3) with key "arg3"
//    with result of the operation call
f = call Foo(arg1 = a, arg2 = b, arg3 = 2)
```
