
import camelCase from 'lodash.camelcase'
import property from 'ov-object-path'
import {validateUserInput, processError} from 'cs-api-authentication-errors'
import {AuthenticationDetails, CognitoUserPool, CognitoUserAttribute, CognitoUser} from 'amazon-cognito-identity-js'

const getUsernameFromEmail = (email) => email && email.replace(/@/g, '+');

class AuthService {

	constructor(clientId, userPoolId) {

		this.clientId = clientId;
		this.userPoolId = userPoolId;

		this.signIn = this.signIn.bind(this);
		this.signOut = this.signOut.bind(this);
		this.forgotPassword = this.forgotPassword.bind(this);
		this.forgotPasswordConfirm = this.forgotPasswordConfirm.bind(this);
		this.resetPassword = this.resetPassword.bind(this);
		this.resetPasswordConfirm = this.resetPasswordConfirm.bind(this);
		this.signUp = this.signUp.bind(this);
		this.signUpConfirm = this.signUpConfirm.bind(this);
		this.resendConfirmationCode = this.resendConfirmationCode.bind(this);
		this.getUserByEmail = this.getUserByEmail.bind(this);

	}

	get session() {
		const _state = this;
		return {
			get loadIdToken() {
				return _state.loadIdToken;
			}
		};
	}

	get loadSession() {
		return new Promise((resolve, reject) => {
			if (!this.user) {
			return reject(['not signed in']);
		}
		try {
			this.user.getSession((err, session) => {
				if (err) {
					return reject([err]);
				}
				if (!(session && session.isValid())) {
				return reject(['not signed in']);
			}
			return resolve({session});
		});
		} catch (error) {
			reject([error]);
		}
	});
	}

	get loadIdToken() {
		return this.loadSession.then(({session}) => {
			const token = session.getIdToken();
		const expiresOn = token.getExpiration();
		const jwt = token.getJwtToken();
		return {jwt, expiresOn};
	});
	}

	get username() {
		if (this.user) {
			return this.user.getUsername();
		}
	}

	get checkSessionIsValid() {
		return new Promise((resolve, reject) => {
			if (this.user) {
			try {
				this.user.getSession((err, session) => {
					if (err) {
						return reject(AuthService.processServiceErrors(err));
					}
					if (session && session.isValid()) {
					return resolve();
				}
			});
			} catch (error) {
				reject(error);
			}
		} else {
			reject();
		}
	});
	}

	getUserByEmail(email) {
		return new CognitoUser({Username: getUsernameFromEmail(email), Pool: this.userPool});
	}

	get userPool() {
		return new CognitoUserPool({
			UserPoolId: this.userPoolId,
			ClientId: this.clientId
		});
	}

	get user() {
		return this.userPool.getCurrentUser();
	}

	signOut(data) {
		return new Promise((resolve, reject) => {
			if (this.user) {
			this.user.signOut();
		}
		const email = data.email;
		if (email && typeof email === 'string') {
			this.getUserByEmail(email).signOut();
		}
		resolve();
	});
	}

	signIn(data) {
		return new Promise((resolve, reject) => {

			const requiredFields = ['email', 'password'],
			validations = validateUserInput(requiredFields, data);

		if (validations) {
			return reject(validations.messages);
		}

		const email = data.email,
			password = data.password,
			user = this.getUserByEmail(email),
			authenticationData = {
				Username: user.getUsername(),
				Password: password
			},
			authenticationDetails =
				new AuthenticationDetails(authenticationData);

		user.authenticateUser(authenticationDetails, {
			onSuccess: () => {
			user.getUserAttributes((err, result) => {
			result = result instanceof Array ? result : [];
		const userInfo = result.reduce((map, attr) => {
			map[camelCase(attr.Name)] = attr.Value;
		return map;
	}, {});
		resolve(userInfo);
	});
	},
		onFailure: function (err) {
			//{"__type":"InvalidPasswordException","message":"Password does not conform to policy: Password not long enough"}
			//{"__type":"InvalidParameterException","message":"1 validation error detected: Value at 'password' failed to satisfy constraint: Member must have length greater than or equal to 6"}
			//{"__type":"PasswordResetRequiredException","message":"Password reset required for the user"}
			//{"__type":"UserNotFoundException","message":"User does not exist."}
			//{"__type":"UserNotConfirmedException","message":"User is not confirmed."}
			//{"__type":"NotAuthorizedException","message":"Incorrect username or password."}
			return reject(AuthService.processServiceErrors(err));
		}
	});

	});
	}

	forgotPassword(data) {
		return new Promise((resolve, reject) => {

			const requiredFields = ['email'],
			validations = validateUserInput(requiredFields, data);

		if (validations) {
			return reject(validations.messages);
		}

		const user = this.getUserByEmail(data.email);

		user.forgotPassword({
			onSuccess: function (result) {
				let message;
				if (property.get(result, 'CodeDeliveryDetails.DeliveryMedium') === 'EMAIL') {
					message = `A confirmation code was emailed to: ${result.Destination}.`;
				} else if (property.get(result, 'CodeDeliveryDetails.DeliveryMedium') === 'SMS') {
					message = `A confirmation code was SMS messaged to: ${result.Destination}.`;
				} else {
					message = 'A confirmation code was sent to you.'
				}
				resolve([{code: 'CodeDeliveryDetails', message}]);
			},
			onFailure: function (err) {
				reject(AuthService.processServiceErrors(err));
			}
		});
	});
	}

	forgotPasswordConfirm(data) {
		return new Promise((resolve, reject) => {

			const requiredFields = ['code', 'newPassword'],
			validations = validateUserInput(requiredFields, data);

		if (!this.user) {
			requiredFields.push('email');
		}

		if (validations) {
			return reject(validations.messages);
		}

		const email = data.email,
			code = data.code,
			newPassword = data.newPassword,
			user = this.user || this.getUserByEmail(email);

		user.confirmPassword(code, newPassword, {
			onFailure(err) {
				//{"__type":"CodeMismatchException","message":"Invalid verification code provided, please try
				// again."} {"__type":"InvalidParameterException","message":"1 validation error detected: Value at
				// 'password' failed to satisfy constraint: Member must have length greater than or equal to 6"}
				// {"__type":"ExpiredCodeException","message":"Invalid code provided, please request a code
				// again."}
				return reject(AuthService.processServiceErrors(err));
			},
			onSuccess(result) {
				resolve(['Your password is updated.']);
			}
		});

	});
	}

	resetPassword(data) {
		return this.forgotPassword(data);
	}

	resetPasswordConfirm(data) {
		return this.forgotPasswordConfirm(data);
	}

	signUp(data) {
		return new Promise((resolve, reject) => {

			const requiredFields = ['name', 'email', 'password'],
			validations = validateUserInput(requiredFields, data);

		if (validations) {
			return reject(validations.messages);
		}

		const name = data.name, email = data.email, password = data.password;

		const attributeList = [];

		if (name) {
			const attributeEmail = new CognitoUserAttribute({
				Name: 'name',
				Value: name
			});
			attributeList.push(attributeEmail);
		}

		if (email) {
			const attributeEmail = new CognitoUserAttribute({
				Name: 'email',
				Value: email
			});
			attributeList.push(attributeEmail);
		}

		const username = getUsernameFromEmail(email);

		//http://docs.aws.amazon.com/cognito/latest/developerguide/using-amazon-cognito-user-identity-pools-javascript-examples.html
		this.userPool.signUp(username, password, attributeList, null, (err, result) => {
			if (err) {
				return reject(AuthService.processServiceErrors(err));
			}
			resolve([result]);
	});

	});
	}

	signUpConfirm(data) {
		return new Promise((resolve, reject) => {

			const requiredFields = ['email', 'code'],
			validations = validateUserInput(requiredFields, data);

		if (validations) {
			return reject(validations.messages);
		}

		const email = data.email,
			code = data.code,
			user = this.getUserByEmail(email);

		user.confirmRegistration(code, true, function (err, result) {
			if (err) {
				return reject(AuthService.processServiceErrors(err));
			}
			const message = `Your email address is confirmed.`;
			resolve([message]);
		});

	});
	}

	resendConfirmationCode(data) {
		return new Promise((resolve, reject) => {

			const requiredFields = ['email'],
			validations = validateUserInput(requiredFields, data);

		if (validations) {
			return reject(validations.messages);
		}

		const email = data.email,
			user = this.getUserByEmail(email);

		user.resendConfirmationCode(function (err, result) {
			if (err) {
				return reject(AuthService.processServiceErrors(err));
			}
			let message;
			if (property.get(result, 'CodeDeliveryDetails.DeliveryMedium') === 'EMAIL') {
				message = `A confirmation code was emailed to: ${result.Destination}.`;
			} else if (property.get(result, 'CodeDeliveryDetails.DeliveryMedium') === 'SMS') {
				message = `A confirmation code was SMS messaged to: ${result.Destination}.`;
			} else {
				message = 'A confirmation code was sent to you.'
			}
			resolve([{code: 'CodeDeliveryDetails', message}]);
		});
	});
	}

	static processServiceErrors(error) {
		console.log('processServiceErrors', error);
		return processError(error);
	}

}

export default AuthService;
