import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import {User} from "../models/user_model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/apiResponse.js"
import jwt from "jsonwebtoken"
import { response } from "express";

// we wil not use asyncHandler here as it is not a web request
// It's just internal method that's why we use async
const generateAccessAndRefereshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false }) // used to avoid password re-save

        return {accessToken, refreshToken}


    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}


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

const loginUser = asyncHandler(async (req, res) =>{
    // req body -> data
    // username or email
    //find the user
    //password check
    //access and referesh token
    //send cookie

    const {email, username, password} = req.body

    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }
    
    // Here is an alternative of above code based on logic discussed in video:
    // if (!(username || email)) {
    //     throw new ApiError(400, "username or email is required")
        
    // }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

   const isPasswordValid = await user.isPasswordCorrect(password)

   if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials")
    }

   const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )

})

const logoutUser = asyncHandler(async (req, res) => {
    // Clear user's session data
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // Remove the refreshToken field from the document
            }
        },
        {
            new: true // Return the updated document
        }
    );

    // Clear cookies from the client-side
    const options = {
        httpOnly: true,
        secure: true
    };

    return res
        .status(200)
        .clearCookie("accessToken", options) // Clear the accessToken cookie
        .clearCookie("refreshToken", options) // Clear the refreshToken cookie
        .json(new ApiResponse(200, {}, "User logged out successfully"));
});


const refreshAccessToken = asyncHandler( async (req, res) => {
    // Get token from cookies
    // Verify refresh token
    // Match both incomimg and decoded token
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken){
        throw new ApiError(401, "Unauthenticated request");
    }
    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user){
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh token is expired or used")
        }
        const options = {
            httpOnly: true,
            secure: true,
        }
        const {newaccessToken, newrefreshToken} = await generateAccessAndRefereshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", newaccessToken, options)
        .cookie("refreshToken", newrefreshAccessToken, options)
        .json(
            new ApiResponse(
                200,
                {newaccessToken, newrefreshToken},
                "Access Token Refresh successfully"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
})

const changeCurrentPassword = asyncHandler ( async (req, res) => {
    const {oldPassword, newPassword, confirmPassword} = req.body

    if (newPassword !== confirmPassword) {
        throw new ApiError(401, "Passwords do not match")
    }

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if (!isPasswordCorrect){
        throw new ApiError(400, "Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json (new ApiResponse(200, {}, "Password changed successfully"))


})

const getCurrentUser = asyncHandler( async (req, res) => {
    return res
    .status(200)
    .json(200, req.user, "current user fetch successfully") // In this request, middleware runs and we get the user from req.user

})

const updateAccountDetails = asyncHandler( async (req, res) => {
    const {fullName, email} = req.body
    if (!fullName || !email){
        throw new ApiError(400, "all feilds are required")
    }
    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {  // set receives a object
                fullName: fullName,
                email: email,
            }
        },
        {new: true} // Return information after update
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, "User updated successfully"))
})

// If we need to change file (images/....) , create separate endpoint: Good Practice

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path // we use req.file instead of files and get this file from multer_middleware

    if (!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if (!avatar.url){
        throw new ApiError(400, "erro while uploading on avatar")
    }
    const user = await User.findByIdAndUpdate(
        res.user._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")
    return res.status(200).json(
        new ApiResponse(200, user, "Avatar updated successfully")
    )
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path // we use req.file instead of files and get this file from multer_middleware

    if (!coverImageLocalPath){
        throw new ApiError(400, "Cover Image file is missing")
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if (!coverImage.url){
        throw new ApiError(400, "erro while uploading on coverImage")
    }
    const user = await User.findByIdAndUpdate(
        res.user._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res.status(200).json(
        new ApiResponse(200, user, "Cover Image updated successfully")
    )
})



export{
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage
}