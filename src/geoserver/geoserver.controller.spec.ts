import { Test, TestingModule } from '@nestjs/testing';
import { GeoserverController } from './geoserver.controller';

describe('GeoserverController', () => {
  let controller: GeoserverController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GeoserverController],
    }).compile();

    controller = module.get<GeoserverController>(GeoserverController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
