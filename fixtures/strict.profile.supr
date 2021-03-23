"""
Title

Description
"""
profile = "example/profile"
version = "0.1.0"

# https://sfspec.surge.sh/profile#sec-Use-case
"usecase title"
usecase Foo {
	input {
    	"field title"
    	field! string!
		# https://sfspec.surge.sh/profile#UnionModel
        field number | boolean, field boolean
    }
    
    # https://sfspec.surge.sh/profile#ScalarModel
    result number
    
    # https://sfspec.surge.sh/profile#sec-List-Model
	# https://sfspec.surge.sh/profile#sec-Alias-Model
    async result [FooModel]
    
    # https://sfspec.surge.sh/profile#EnumModel
    error enum {
    	NOT_FOUND = 404,
        BAD_REQUEST = 400
    } 
}

# https://sfspec.surge.sh/profile#sec-Named-Model
# https://sfspec.surge.sh/profile#sec-Object-Model
"Title"
model FooModel {
	foo bar! | baz!
}

# https://sfspec.surge.sh/profile#sec-Named-Field
"Title"
field foo string!