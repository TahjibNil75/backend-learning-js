class ApiError extends Error{
    constructor(
        statusCode,
        message = "Something went wrong",
        errors = [],
        stack = ""
    ){
        super(message)
        this.statusCode = statusCode
        this.data = null, // TODO: study on this.data
        this.message = message
        this.success = false, // As e throw api error so in response we use false for api success response
        this.errors = errors

        if (stack){ // Todo: Study on stack
            this.stack = stack
        }else {
            Error.captureStackTrace(this, this.constructor)
        }
    }
}

export {ApiError}