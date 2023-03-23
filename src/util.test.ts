import { getCode, getPlatformId } from './util';

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
