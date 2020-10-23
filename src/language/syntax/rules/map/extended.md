# Superface Parser X

## Nested object literals

Allows nesting object literals inside of object literals:

```
foo {
	bar {
		baz = 1
	}
}
```

## Http slots shorthand

Allows shorthand http request slots:

```
request query { q = 1 }

request headers {
	header = 1
}

request body = "something"
```
