import {v2 as cloudinary} from 'cloudinary';
import fs from 'fs'; // fs means file system management
          
cloudinary.config({ 
  cloud_name: process.env.CLOUINARY_CLOUD_NAME, 
  api_key: process.env.CLOUINARY_API_KEY, 
  api_secret: process.env.CLOUINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null
        //Upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })
        // File has been uploaded successfully
        console.log("File uploaded successfully on cloudinary", response.url); // Need to keep it . if not avatr upload failed
        fs.unlinkSync(localFilePath)
        return response
    } catch (error) {
        fs.unlinkSync(localFilePath) // remove the locally saved temp file as the upload operation got failed
        return null
    }
}

export {uploadOnCloudinary}
