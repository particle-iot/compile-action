import { getCode } from "../src/main";

describe('getCode', () => {
	it('should return a list of files', () => {
		const path = './src';
		const files = getCode(path)
		expect(files).toBeDefined();
		expect(files[`${path}/main.ts`]).toBeDefined();
		expect(files[`${path}/main.ts`].toString()).toContain('export function getCode(path: string)');
	});
});
