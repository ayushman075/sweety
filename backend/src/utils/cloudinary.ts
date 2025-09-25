import {v2 as cloudinary} from 'cloudinary';
import fs from "fs"

    const uploadFileOnCloudinary=async(localFilePath:string): Promise<string|null>=>{
        cloudinary.config({ 
            cloud_name: `${process.env.CLOUDINARY_CLOUD_NAME}`, 
            api_key: `${process.env.CLOUDINARY_API_KEY}`, 
            api_secret: `${process.env.CLOULINARY_SECRET_KEY}`
        })
try {
    if(!localFilePath) return null;
  
    const response = await cloudinary.uploader.upload(localFilePath,{
        resource_type:'auto',
    })
 
console.log("File uploaded on cloudinary ",response.url)
     
      fs.unlinkSync(localFilePath)
      return response.url;
} catch (error) {
     console.log(error)
    fs.unlinkSync(localFilePath)
    return null;
}
    }


    export {uploadFileOnCloudinary}