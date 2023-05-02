import {
	_resetBuildTargets,
	fetchBuildTargets,
	getCode,
	resolveVersion,
	getPlatformId,
	validatePlatformDeviceOsTarget, validatePlatformName, renameFile
} from './util';
import nock from 'nock';
import { accessSync, mkdirSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

describe('getCode', () => {
	it('should return file for application.cpp', () => {
		const path = `./test/fixtures/single-file-firmware`;
		const files = getCode(path);
		expect(files).toBeDefined();
		expect(files[`application.cpp`]).toBeDefined();
		expect(files[`application.cpp`].toString()).toEqual(`test/fixtures/single-file-firmware/application.cpp`);
	});

	it('should return files for tracker-edge', () => {
		const path = `test/fixtures/tracker-edge-dir-tree`;
		const files = getCode(path);
		expect(files).toBeDefined();
		expect(files).toEqual({
			'lib/AM1805/src/AM1805.cpp': `${path}/lib/AM1805/src/AM1805.cpp`,
			'lib/AM1805/src/AM1805.h': `${path}/lib/AM1805/src/AM1805.h`,
			'lib/Thermistor/src/thermistor.h': `${path}/lib/Thermistor/src/thermistor.h`,
			'lib/Thermistor/test/main.cpp': `${path}/lib/Thermistor/test/main.cpp`,
			'lib/bmi160/src/bmi160.cpp': `${path}/lib/bmi160/src/bmi160.cpp`,
			'lib/bmi160/src/bmi160.h': `${path}/lib/bmi160/src/bmi160.h`,
			'lib/bmi160/src/bmi160regs.h': `${path}/lib/bmi160/src/bmi160regs.h`,
			'lib/bmi160/test/main.cpp': `${path}/lib/bmi160/test/main.cpp`,
			'lib/can-mcp25x/example/test.cpp': `${path}/lib/can-mcp25x/example/test.cpp`,
			'lib/can-mcp25x/src/mcp_can.cpp': `${path}/lib/can-mcp25x/src/mcp_can.cpp`,
			'lib/can-mcp25x/src/mcp_can.h': `${path}/lib/can-mcp25x/src/mcp_can.h`,
			'lib/can-mcp25x/src/mcp_can_dfs.h': `${path}/lib/can-mcp25x/src/mcp_can_dfs.h`,
			'lib/fw-config-service/src/background_publish.cpp': `${path}/lib/fw-config-service/src/background_publish.cpp`,
			'lib/fw-config-service/src/background_publish.h': `${path}/lib/fw-config-service/src/background_publish.h`,
			'lib/fw-config-service/src/cloud_service.cpp': `${path}/lib/fw-config-service/src/cloud_service.cpp`,
			'lib/fw-config-service/src/cloud_service.h': `${path}/lib/fw-config-service/src/cloud_service.h`,
			'lib/fw-config-service/src/config_service.cpp': `${path}/lib/fw-config-service/src/config_service.cpp`,
			'lib/fw-config-service/src/config_service.h': `${path}/lib/fw-config-service/src/config_service.h`,
			'lib/fw-config-service/src/config_service_nodes.h': `${path}/lib/fw-config-service/src/config_service_nodes.h`,
			'lib/fw-config-service/src/murmur3.cpp': `${path}/lib/fw-config-service/src/murmur3.cpp`,
			'lib/fw-config-service/src/murmur3.h': `${path}/lib/fw-config-service/src/murmur3.h`,
			'lib/gps-nmea-parser/src/gps/gps.cpp': `${path}/lib/gps-nmea-parser/src/gps/gps.cpp`,
			'lib/gps-nmea-parser/src/gps/gps.h': `${path}/lib/gps-nmea-parser/src/gps/gps.h`,
			'lib/gps-ublox/src/ubloxGPS.cpp': `${path}/lib/gps-ublox/src/ubloxGPS.cpp`,
			'lib/gps-ublox/src/ubloxGPS.h': `${path}/lib/gps-ublox/src/ubloxGPS.h`,
			'project.properties': `${path}/project.properties`,
			'src/gnss_led.cpp': `${path}/src/gnss_led.cpp`,
			'src/gnss_led.h': `${path}/src/gnss_led.h`,
			'src/location_service.cpp': `${path}/src/location_service.cpp`,
			'src/location_service.h': `${path}/src/location_service.h`,
			'src/main.cpp': `${path}/src/main.cpp`,
			'src/motion_service.cpp': `${path}/src/motion_service.cpp`,
			'src/motion_service.h': `${path}/src/motion_service.h`,
			'src/temperature.cpp': `${path}/src/temperature.cpp`,
			'src/temperature.h': `${path}/src/temperature.h`,
			'src/tracker.cpp': `${path}/src/tracker.cpp`,
			'src/tracker.h': `${path}/src/tracker.h`,
			'src/tracker_cellular.cpp': `${path}/src/tracker_cellular.cpp`,
			'src/tracker_cellular.h': `${path}/src/tracker_cellular.h`,
			'src/tracker_config.h': `${path}/src/tracker_config.h`,
			'src/tracker_location.cpp': `${path}/src/tracker_location.cpp`,
			'src/tracker_location.h': `${path}/src/tracker_location.h`,
			'src/tracker_motion.cpp': `${path}/src/tracker_motion.cpp`,
			'src/tracker_motion.h': `${path}/src/tracker_motion.h`,
			'src/tracker_rgb.cpp': `${path}/src/tracker_rgb.cpp`,
			'src/tracker_rgb.h': `${path}/src/tracker_rgb.h`,
			'src/tracker_shipping.cpp': `${path}/src/tracker_shipping.cpp`,
			'src/tracker_shipping.h': `${path}/src/tracker_shipping.h`,
			'src/tracker_sleep.cpp': `${path}/src/tracker_sleep.cpp`,
			'src/tracker_sleep.h': `${path}/src/tracker_sleep.h`
		});
	});
});

describe('getPlatformId', () => {
	it('should return the correct platform id', () => {
		expect(getPlatformId('electron')).toEqual(10);
		expect(getPlatformId('argon')).toEqual(12);
		expect(getPlatformId('boron')).toEqual(13);
		expect(getPlatformId('tracker')).toEqual(26);
	});

	it('should throw an error if the platform is not supported', () => {
		expect(() => getPlatformId('not_a_platform')).toThrow();
	});

	it('should throw an error if the platform is not public', () => {
		expect(() => getPlatformId('gcc')).toThrow();
	});
});

describe('fetchBuildTargets', () => {

	beforeEach(() => {
		_resetBuildTargets();
	});

	it('should return the build targets', async () => {
		nock('https://api.particle.io')
			.get('/v1/build_targets')
			.replyWithFile(200, `test/fixtures/build-targets-json/response.json`);

		const response = JSON.parse(readFileSync(`test/fixtures/build-targets-json/response.json`).toString());

		expect(await fetchBuildTargets()).toEqual(response);
	});

	it('should return the cached response if it has already been fetched', async () => {
		nock('https://api.particle.io')
			.get('/v1/build_targets')
			.once()
			.replyWithFile(200, `test/fixtures/build-targets-json/response.json`);

		const res1 = await fetchBuildTargets();
		const res2 = await fetchBuildTargets();
		expect(res1).toEqual(res2);
		expect(nock.pendingMocks()).toHaveLength(0);
	});

	it('should throw an error if the api is not found', async () => {
		nock('https://api.particle.io')
			.get('/v1/build_targets')
			.reply(404);

		await expect(fetchBuildTargets()).rejects.toThrow('Error fetching build targets: 404');
	});
});

describe('validatePlatformName', () => {
	it('should return true if the platform is valid', () => {
		expect(validatePlatformName('electron')).toEqual(true);
	});
	it('should throw an error if the platform is not valid', () => {
		expect(() => validatePlatformName('not_a_platform')).toThrow();
	});
});

describe('validatePlatformDeviceOsTarget', () => {
	it('should return true if there is a device os version the supports the target platform', async () => {
		nock('https://api.particle.io')
			.get('/v1/build_targets')
			.replyWithFile(200, `test/fixtures/build-targets-json/response.json`);

		expect(await validatePlatformDeviceOsTarget('core', '1.4.4')).toEqual(true);
		expect(await validatePlatformDeviceOsTarget('argon', '4.0.2')).toEqual(true);
	});

	it('should throw if there is not a device os version the supports the target platform', async () => {
		nock('https://api.particle.io')
			.get('/v1/build_targets')
			.replyWithFile(200, `test/fixtures/build-targets-json/response.json`);

		await expect(validatePlatformDeviceOsTarget('core', '2.3.1')).rejects.toThrow(`Device OS version '2.3.1' does not support platform 'core'`);
		await expect(validatePlatformDeviceOsTarget('trackerm', '2.3.1')).rejects.toThrow(`Device OS version '2.3.1' does not support platform 'trackerm'`);
	});

	it('should throw if the device os version is not valid', async () => {
		nock('https://api.particle.io')
			.get('/v1/build_targets')
			.replyWithFile(200, `test/fixtures/build-targets-json/response.json`);

		await expect(validatePlatformDeviceOsTarget('core', '0.0.0')).rejects.toThrow(`Device OS version '0.0.0' does not exist`);
	});
});

describe('resolveVersion', () => {
	beforeAll(() => {
		nock('https://api.particle.io')
			.get('/v1/build_targets')
			.replyWithFile(200, `test/fixtures/build-targets-json/response.json`);
	});

	it('should return the default version for each platform', async () => {
		expect(await resolveVersion('argon', 'default')).toEqual('4.0.2');
		expect(await resolveVersion('boron', 'default')).toEqual('4.0.2');
		expect(await resolveVersion('esomx', 'default')).toEqual('4.0.2');
		expect(await resolveVersion('bsom', 'default')).toEqual('4.0.2');
		expect(await resolveVersion('b5som', 'default')).toEqual('4.0.2');
		expect(await resolveVersion('tracker', 'default')).toEqual('4.0.2');
		expect(await resolveVersion('electron', 'default')).toEqual('2.3.1');
		expect(await resolveVersion('photon', 'default')).toEqual('2.3.1');
		expect(await resolveVersion('xenon', 'default')).toEqual('0.9.0');
		expect(await resolveVersion('core', 'default')).toEqual('0.7.0');
		expect(await resolveVersion('p1', 'default')).toEqual('2.3.1');
		expect(await resolveVersion('trackerm', 'default')).toEqual('5.3.1');
		expect(await resolveVersion('p2', 'default')).toEqual('5.3.1');
	});

	it('should return the latest version for each platform', async () => {
		expect(await resolveVersion('argon', 'latest')).toEqual('5.3.1');
		expect(await resolveVersion('boron', 'latest')).toEqual('5.3.1');
		expect(await resolveVersion('esomx', 'latest')).toEqual('5.3.1');
		expect(await resolveVersion('bsom', 'latest')).toEqual('5.3.1');
		expect(await resolveVersion('b5som', 'latest')).toEqual('5.3.1');
		expect(await resolveVersion('tracker', 'latest')).toEqual('5.3.1');
		expect(await resolveVersion('electron', 'latest')).toEqual('3.3.1');
		expect(await resolveVersion('photon', 'latest')).toEqual('3.3.1');
		expect(await resolveVersion('xenon', 'latest')).toEqual('1.5.2');
		expect(await resolveVersion('core', 'latest')).toEqual('1.4.4');
		expect(await resolveVersion('p1', 'latest')).toEqual('3.3.1');
		expect(await resolveVersion('trackerm', 'latest')).toEqual('5.3.1');
		expect(await resolveVersion('p2', 'latest')).toEqual('5.3.1');
	});

	it('should return the latest LTS version for each platform that has one', async () => {
		expect(await resolveVersion('argon', 'latest-lts')).toEqual('4.0.2');
		expect(await resolveVersion('boron', 'latest-lts')).toEqual('4.0.2');
		expect(await resolveVersion('esomx', 'latest-lts')).toEqual('4.0.2');
		expect(await resolveVersion('bsom', 'latest-lts')).toEqual('4.0.2');
		expect(await resolveVersion('b5som', 'latest-lts')).toEqual('4.0.2');
		expect(await resolveVersion('tracker', 'latest-lts')).toEqual('4.0.2');
		expect(await resolveVersion('electron', 'latest-lts')).toEqual('2.3.1');
		expect(await resolveVersion('photon', 'latest-lts')).toEqual('2.3.1');
		expect(await resolveVersion('p1', 'latest-lts')).toEqual('2.3.1');
	});

	it('should throw for platforms that do not have an LTS version', async () => {
		await expect(resolveVersion('xenon', 'latest-lts')).rejects.toThrow(`No latest-lts build target found. The latest Device OS version for 'xenon' is '1.5.2'`);
		await expect(resolveVersion('core', 'latest-lts')).rejects.toThrow(`No latest-lts build target found. The latest Device OS version for 'core' is '1.4.4'`);
		await expect(resolveVersion('trackerm', 'latest-lts')).rejects.toThrow(`No latest-lts build target found. The latest Device OS version for 'trackerm' is '5.3.1'`);
		await expect(resolveVersion('p2', 'latest-lts')).rejects.toThrow(`No latest-lts build target found. The latest Device OS version for 'p2' is '5.3.1'`);
	});



	it('should return a fixed version', async () => {
		expect(await resolveVersion('argon', '2.3.1')).toEqual('2.3.1');
	});

	it('should return the latest 2.x version', async () => {
		expect(await resolveVersion('argon', '2.x')).toEqual('2.3.1');
	});

	it('should return the latest 2.3.x version', async () => {
		expect(await resolveVersion('argon', '2.3.x')).toEqual('2.3.1');
	});

	it('should handle tilde versions', async () => {
		expect(await resolveVersion('argon', '~4.0.0')).toEqual('4.0.2');
	});

	it('should handle caret versions', async () => {
		expect(await resolveVersion('argon', '^5.0.0')).toEqual('5.3.1');
	});

	it('should throw if the version is not valid', async () => {
		await expect(resolveVersion('argon', '100.0.0')).rejects.toThrow(`No Device OS version satisfies '100.0.0'`);
	});

	it('should throw if the semver version is not valid', async () => {
		await expect(resolveVersion('argon', '^100.0.0')).rejects.toThrow(`No Device OS version satisfies '^100.0.0'`);
	});


});

describe('renameFile', () => {
	const testDir = 'rename-file-output';

	beforeAll(async () => {
		mkdirSync(testDir, { recursive: true });
	});

	afterAll(async () => {
		rmdirSync(testDir, { recursive: true });
	});

	test('renameFile renames the firmware binary file correctly', async () => {
		const filePath = join(testDir, 'firmware.bin');
		const platform = 'boron';
		const version = '1.0.0';

		writeFileSync(filePath, 'dummy content');

		const newFilePath = renameFile({ filePath, platform, version });

		// Check if the old file is removed
		expect(() => accessSync(filePath)).toThrow();

		// Check if the new file is created with the correct name
		const newFileName = `firmware-${platform}-${version}.bin`;
		const expectedNewFilePath = join(testDir, newFileName);
		expect(newFilePath).toBe(expectedNewFilePath);
		expect(() => accessSync(newFilePath)).not.toThrow();

		// Cleanup
		unlinkSync(newFilePath);
	});
});
