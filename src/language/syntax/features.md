# Superface Parser Features

## Map parser

### `nested_object_literals`

Allows nesting object literals inside of object literals and in set blocks:

```
// normal
set {
	// path
	foo.bar.baz = 1

	// jessie
	foo = {
		bar: {
			baz: 1
		}
	}
}

// with `nested_object_literals`
set {
	foo {
		bar {
			baz = 1
		}
	}
}
```

### `shorthand_http_request_slots`

Allows shorthand http request slots:

```
// normal
http GET "url" {
	request "application/json" "en-US" {
		query { q = 1 }

		headers {
			header = 1
		}

		body = "something"
	}
}

// query only
http GET "url" {
	request "application/json" "en-US" query { q = 1 }
}

// headers only
http GET "url" {
	request "application/json" "en-US" headers { header = 1 }
}

// body only
http GET "url" {
	request "application/json" "en-US" body = "something"
}
```

### `multiple_security_schemes`

Allows multiple security schemes:

```
// normal
http GET "url" {
	security "my_token"
}

// multiple
http GET "url" {
	security "my_token"
	security "my_apikey"
	security "my_querykey"
}
```
