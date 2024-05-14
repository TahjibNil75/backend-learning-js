import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import {User} from "../models/user_model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/apiResponse.js"

const registerUser = asyncHandler( async (req, res) => {
    // get user details from request body
    // validation - not emtpy
    // check if user already exists : username, email
    // check for images, check for avatar
    // upload them to cloudnary, avatar
    // create user object as we are using nosql - create entry in db
    // remove password and refres token feild from response 
    // check for user creation 

    const {username, email, fullName, password} = req.body

    // if (fullName == "" ){
    //     throw new ApiError(400, "Full name is required")
    // }else if (email == ""){
    //     throw new ApiError(400, "email is required")
    // }
    // Alternative Approach: using some - Determines whether the specified callback function returns true for any element of an array.
    if ([username,email, fullName, password].some((feilds) => feilds?.trim() === "")){
        throw new ApiError(400, "All feilds are required")
    }


    const existingUser = await User.findOne({ // Resolve error by adding
        $or : [{username}, {email}]
    })
    if (existingUser){
        throw new ApiError(409,"User already exists")
    }

    // express gives us access in request.body, same way multer gives us access for request.files
    const avatarLocalPath = req.files?.avatar[0]?.path; // MUST Checking
    // const coverImageLocalPath = req.files?.coverImage[0]?.path; // OPTIONAL Checking

    // Fix Bug: if cover image is not provided then this process will stil register user
    let coverImageLocalPath;
    // Check if files are uploaded, if coverImage array exists, and if it contains at least one file
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path // Assign the path of the first cover image file to coverImageLocalPath
    }

    if (!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar){
        throw new ApiError(400,"Avatar file is required")
    }

    // asyncHandler's await is used here so that any error occurs asycHandler.js's catch will handle it
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username,
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser){
        throw new ApiError(400,"Something went wrong while creating user")
    }


    return res.status(201).json(
        new ApiResponse(200, createdUser, "User Registered successfully")
    )


})

export{
    registerUser
}