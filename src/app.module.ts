import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GeoserverController } from './geoserver/geoserver.controller';
import { MulterModule } from '@nestjs/platform-express';

@Module({
  imports: [MulterModule.register({
    dest: '../uploads', // Specify the directory where uploaded files will be stored
  }),],
  controllers: [AppController, GeoserverController],
  providers: [AppService],
})
export class AppModule {}
