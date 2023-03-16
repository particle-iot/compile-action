
// Need to figure out how to get ts-jest to work with the allowJs flag in tsconfig.json
//
// import { getCode } from "../src/main";
//
// describe('getCode', () => {
// 	it('should return a list of files', () => {
// 		const path = './src';
// 		const files = getCode(path)
// 		expect(files).toBeDefined();
// 		expect(files[`${path}/main.ts`]).toBeDefined();
// 		expect(files[`${path}/main.ts`].toString()).toContain('export function getCode(path: string)');
// 	});
// });

describe('particleCompile', () => {
	it('should have a tests', () => {
		expect(true).toBe(true);
	});
});
