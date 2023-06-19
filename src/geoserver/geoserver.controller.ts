import { Controller, Post, Put, UploadedFile, UseInterceptors, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import * as http from "http";
import * as AdmZip from 'adm-zip';

const storage = diskStorage({
  destination: './uploads',
  filename: (_, file, callback) => {
    const filename = `${file.originalname}`;
    callback(null, filename);
  },
});
const workspace = 'personal';
const datastore = 'personal_store';
const geoserver_url = 'http://localhost:8080/geoserver/';
const geoserverusername = 'admin'
const geoserverpassword = 'geoserver'


async function associateStyleWithCoverage(coverageName: string, styleName: string) {
  try {
    const layerOptions: http.RequestOptions = {
      port: 8080,
      path: `${geoserver_url}/rest/layers/${workspace}:${coverageName}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${geoserverusername}:${geoserverpassword}`).toString('base64'),
      },
    };

    const layerData = {
      layer: {
        defaultStyle: {
          name: styleName
        }
      }
    };

    const layerReq = http.request(layerOptions, (layerRes) => {
      if (layerRes.statusCode === 200) {
        console.log('Style associated successfully with the coverage!');
      } else {
        console.error('Failed to associate style with the coverage.');
      }
    });

    layerReq.on('error', (error) => {
      console.error('Error associating style with the coverage:', error);
    });

    layerReq.write(JSON.stringify(layerData)); // Write the layer data to the request body
    layerReq.end();
  } catch (error) {
    console.error('An error occurred:', error);
  }
}



@Controller('geoserver')
export class GeoserverController {
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage }))
  async uploadShapefile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file uploaded.');
    }

    const { originalname, path } = file;


    try {
      const uploadUrl = `${geoserver_url}rest/workspaces/${workspace}/datastores/${datastore}/file.shp`;

      const options: http.RequestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/zip',
          'Content-Length': fs.statSync(path).size.toString(),
          'Authorization': 'Basic ' + Buffer.from(`${geoserverusername}:${geoserverpassword}`).toString('base64'),
        },
      };

      const req = http.request(uploadUrl, options, async (res) => {
        if (res.statusCode === 201) {
          console.log('Shapefile uploaded successfully!');

          // Check for and apply .sld file

          function getShapefileFileName(zipFilePath: string): string | null {
            const zip = new AdmZip(zipFilePath);
            const zipEntries = zip.getEntries();

            // Look for the shapefile with a .shp extension
            const shapefileEntry = zipEntries.find((entry) => entry.entryName.toLowerCase().endsWith('.shp'));

            if (shapefileEntry) {
              const shapefileEntryName = shapefileEntry.entryName;
              const shapefileName = shapefileEntryName.substr(0, shapefileEntryName.lastIndexOf('.'));
              return shapefileName;
            }

            return null; // Shapefile not found in the zip
          }

          function getSldFileName(zipFilePath: string): string | null {
            const zip = new AdmZip(zipFilePath);
            const zipEntries = zip.getEntries();

            // Look for the shapefile with a .shp extension
            const shapefileEntry = zipEntries.find((entry) => entry.entryName.toLowerCase().endsWith('.sld'));

            if (shapefileEntry) {
              const shapefileEntryName = shapefileEntry.entryName;
              const shapefileName = shapefileEntryName
              return shapefileName;
            }

            return null; // Shapefile not found in the zip
          }

          const applyStyleToShapefile = (workspace: string, layer: string, style: string) => {
            const username = geoserverusername;
            const password = geoserverpassword;
            const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

            const xmlPayload = `<layer><defaultStyle><name>${style}</name></defaultStyle></layer>`;

            const options = {
              hostname: '4.221.32.87',
              port: 443,
              path: `rest/layers/${workspace}:${layer}`,
              method: 'PUT',
              headers: {
                'Content-Type': 'text/xml',
                'Authorization': auth,
                'Content-Length': xmlPayload.length,
              },
            };

            const req = http.request(options, (res) => {
              console.log(`Status: ${res.statusCode}`);
              res.on('data', (data) => {
                console.log(data.toString());
              });
            });

            req.on('error', (error) => {
              console.error('Error:', error);
            });

            req.write(xmlPayload);
            req.end();
          };


          async function uploadSLDFromZip(zipFilePath: string, uploadUrl: string): Promise<void> {
            try {
              // Read the zip file
              const zip = new AdmZip(zipFilePath);

              // Get the SLD file entry from the zip
              const sldEntry = zip.getEntries().find(entry => entry.entryName.endsWith('.sld'));

              // Check if the SLD file exists in the zip
              if (!sldEntry) {
                throw new Error('SLD file not found in the zip file.');
              }

              // Extract the SLD file to a temporary location
              // Extract the SLD file content from the zip
              var sldContent = sldEntry.getData().toString('utf-8');
              // sldContent = sldContent.replace(/<se:Name>[^<]*<\/se:Name>/, `<se:Name>${getSldFileName(`./uploads/${originalname}`).replace(/\.sld$/, '')}</se:Name>`);
              //sldContent = sldContent.replace(/<UserStyle>([\s\S]*?)<se:Name>[^<]*<\/se:Name>/, `<UserStyle>$1<se:Name>${getSldFileName(`./uploads/${originalname}`).replace(/\.sld$/, '')}</se:Name>`);

              console.log('Modified SLD Content:', sldContent);


              // Set the appropriate headers for the upload request
              const options: http.RequestOptions = {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/vnd.ogc.sld+xml',
                  'Content-Length': sldContent.length.toString(),
                  'Authorization': 'Basic ' + Buffer.from(`${geoserverusername}:${geoserverpassword}`).toString('base64'),
                },
              };

              // Send the upload request
              const req = http.request(uploadUrl, options, async (res) => {
                if (res.statusCode === 201) {
                  console.log('SLD file uploaded successfully!');
                  applyStyleToShapefile(`${workspace}`, getShapefileFileName(`./uploads/${originalname}`), `${getSldFileName(`./uploads/${originalname}`).replace(/\.sld$/, '')}`)
                } else {
                  console.log('Error uploading SLD file:', res.statusCode, res.statusMessage);
                }
              });

              // Handle errors during the upload request
              req.on('error', (error) => {
                console.error('Request error:', error);
                throw new Error(`Failed to upload SLD file. ${error.message}`);
              });

              // Write the SLD content to the request body
              req.write(sldContent);

              // Close the request
              req.end();

              // Delete the temporary file
              //   fs.unlinkSync(tempFilePath);
            } catch (error) {
              console.error('Error uploading SLD file:', error);
              throw new Error(`Failed to upload SLD file. ${error.message}`);
            }
          }


          uploadSLDFromZip(`./uploads/${originalname}`, `${geoserver_url}rest/workspaces/${workspace}/styles`)

          console.log(`shapefilename: ${getShapefileFileName(`./uploads/${originalname}`)} originalname:${originalname} \n `)

          // Cleanup
          //  fs.unlinkSync(path); // Delete the uploaded shapefile zip
        } else {
          console.log('Error uploading shapefile:', res.statusCode, res.statusMessage);
          // Cleanup
          // fs.unlinkSync(path); // Delete the uploaded shapefile zip
        }
      });

      req.on('error', (error) => {
        console.error('Request error:', error);
        throw new Error(`Failed to upload shapefile to GeoServer. ${error.message}`);
      });

      // Read the file and send it in the request body
      const fileStream = fs.createReadStream(path);
      fileStream.pipe(req);

      return 'Shapefile upload in progress...';
    } catch (error) {
      console.error('Error uploading shapefile to GeoServer:', error);
      throw new Error(`Failed to upload shapefile to GeoServer. ${error.message}`);
    }
  }


  @Post('create-coverage-store')
  async createCoverageStore(@Body() payload: { storeName: string }) {
    try {
      const { storeName } = payload;
      const tiffPath = './uploads/April/Rainfall.tif'
      console.log(storeName);
      console.log(workspace);

      const coverageStoreOptions: http.RequestOptions = {
        port: 8080,
        path: `${geoserver_url}/rest/workspaces/${workspace}/coveragestores/${storeName}/coverages`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'Authorization': 'Basic ' + Buffer.from(`${geoserverusername}:${geoserverpassword}`).toString('base64'),
        },
      };

      const xmlPayload = `
      <coverageStore>
        <name>${storeName}</name>
        <type>GeoTIFF</type>
        <url>${tiffPath}</url>
      </coverageStore>
    `;

      const coverageStoreReq = http.request(coverageStoreOptions, (coverageStoreRes) => {
        if (coverageStoreRes.statusCode === 201) {
          console.log('Coverage store created successfully!');
        } else {
          console.error('Failed to create coverage store.');
        }
      });

      coverageStoreReq.on('error', (error) => {
        console.error('Error creating coverage store:', error);
      });

      coverageStoreReq.write(xmlPayload); // Write the XML payload to the request body
      coverageStoreReq.end();
    } catch (error) {
      console.error('An error occurred:', error);
    }
  }




  @Post('upload-tiff')
  async uploadTiff(@Body() payload: { workspace: string, storeName: string, filePath: string }) {
    try {
      const { workspace, storeName, filePath } = payload;

      const tiffData = fs.readFileSync(filePath);

      const coverageOptions: http.RequestOptions = {
        port: 8080,
        path: `/geoserver/rest/workspaces/${workspace}/coveragestores/${storeName}/file.geotiff`,
        method: 'PUT',
        headers: {
          'Content-Type': 'image/tiff',
          'Content-Length': Buffer.byteLength(tiffData),
          'Authorization': 'Basic ' + Buffer.from(`${geoserverusername}:${geoserverpassword}`).toString('base64'),
        },
      };

      const coverageReq = http.request(coverageOptions, (coverageRes) => {
        if (coverageRes.statusCode === 201) {
          console.log('TIFF file uploaded successfully as a coverage!');
          associateStyleWithCoverage("personal_tiff", "Rainfall")
        } else {
          console.error('Failed to upload TIFF file as a coverage.');
        }
      });

      coverageReq.on('error', (error) => {
        console.error('Error uploading TIFF file:', error);
      });

      coverageReq.write(tiffData); // Write the TIFF file data to the request body
      coverageReq.end();
    } catch (error) {
      console.error('An error occurred:', error);
    }
  }
}
