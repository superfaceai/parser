import fs from 'fs';
import * as unparse from './index';

function nope(): never {
	console.error('Usage: unparse map|profile --json|--eval --stdin|FILE')
	process.exit(1)
}

function readStdin(): string {
	const value = fs.readFileSync(0).toString()

	if (value.trim() == '') {
		console.error('Invalid stdin input')
		nope()
	}

	return value
}
function readFile(path: string): string {
	if (path === undefined || path.trim() === '') {
		console.error('Invalid file input')
		nope()
	}

	return fs.readFileSync(path).toString()
}
function readInput(): string {
	const arg = process.argv[4]
	switch (arg) {
		case undefined:
			nope()

		case '--stdin':
		case '-':
			return readStdin()
		
		default:
			return readFile(arg)
	}
}

function parseInput(input: string): unknown {
	const arg = process.argv[3]
	switch (arg) {
		case '--eval':
		case '-e':
			return eval(input)
		
		case '--json':
		case '-j':
			return JSON.parse(input)
		
		default:
			nope()
	}
}

function unparseInput(input: unknown): string {
	const arg = process.argv[2]
	switch (arg) {
		case 'map':
		case 'm':
			return new unparse.MapUnparser(input as any).unparse()
		
		case 'profile':
		case 'p':
			throw 'TODO'

		default:
			nope()
	}
}

const input = readInput()
const parsed = parseInput(input)
const unparsed = unparseInput(parsed)
console.log(unparsed)
