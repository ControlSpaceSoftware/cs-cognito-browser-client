# cs-cognito-browser-client
simple wrapper for the aws cognito api

# Usage
```
import {AuthService} from 'cs-cognito-browser-client'
const clientId = 'aws cognito client id';
const userPoolId = 'aws cognito user pool id';
const authService = new AuthService(clientId, userPoolId);

authService.checkSessionIsValid().then(...).catch(...);

// call these action function with parameters accordingly
authService.forgotPassword()
authService.forgotPasswordConfirm()
authService.resendConfirmationCode()
authService.signIn()
authService.signOut()
authService.signUp()
authService.signUpConfirm()

```


