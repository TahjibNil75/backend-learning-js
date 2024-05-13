import multer from "multer"; 
import { v4 as uuidv4 } from 'uuid'; // Importing v4 function from uuid package to generate unique identifiers

// Configuring multer storage
const storage = multer.diskStorage({
    // Destination function to specify where to store the uploaded files
    destination: function(req, file, cb) {
        cb(null, "./public/temp"); // Setting the destination directory to "./public/temp"
    },
    // Filename function to define how to name the uploaded files
    filename: function(req, file, cb) {
        const uniqueFileName = `${uuidv4()}-${file.originalname}`; 
        cb(null, uniqueFileName); 
    }
});

// Exporting multer instance with configured storage
export const upload = multer({
    storage
});
