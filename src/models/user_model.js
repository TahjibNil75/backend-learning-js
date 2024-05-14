import mongoose, {Schema} from "mongoose";
import Jwt from "jsonwebtoken";
import bcrypt from "bcrypt";


const userSchema = new Schema({
    username: {
        type: string,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true,
    },
    email: {
        type: string,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    fullname: {
        type: string,
        required: true,
        trim: true,
        index: true,
    },
    avatar: {
        type: string, // cloudnary or aws s3
        required: true,
    },
    coverImage:{
        type: string,
    },
    watchHistory: [
        {
            type: Schema.Types.ObjectId,
            ref: "Video"
        }
    ],
    password:{
        type: string,
        required: [true, 'password is required'],
    },
    refreshToken:{
        type: string,
    }

}, {timestamps: true})

/*
1. Pre is hook which will run before executing any command
2. if(!this.isModified("password") is user so that it will only change when password is changed. for rest of the feild update it wont work
*/
userSchema.pre("save", async function(next){
    if(!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 10)
    next()
})

userSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password, this.password)
}

// Don't need async here because it require vey less time to genrate access token
userSchema.methods.generateAccessToken = function(){
    Jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            fullname: this.fullname,
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}
userSchema.methods.generateRefreshToken = function(){
    Jwt.sign(
        {
            _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

export const User = mongoose.model("User", userSchema);