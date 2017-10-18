'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = require('lodash.camelcase');

var _lodash2 = _interopRequireDefault(_lodash);

var _ovObjectPath = require('ov-object-path');

var _ovObjectPath2 = _interopRequireDefault(_ovObjectPath);

var _csApiAuthenticationErrors = require('cs-api-authentication-errors');

var _amazonCognitoIdentityJs = require('amazon-cognito-identity-js');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var getUsernameFromEmail = function getUsernameFromEmail(email) {
	return email && email.replace(/@/g, '+');
};

var AuthService = function () {
	function AuthService(clientId, userPoolId) {
		_classCallCheck(this, AuthService);

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

	_createClass(AuthService, [{
		key: 'getUserByEmail',
		value: function getUserByEmail(email) {
			return new _amazonCognitoIdentityJs.CognitoUser({ Username: getUsernameFromEmail(email), Pool: this.userPool });
		}
	}, {
		key: 'signOut',
		value: function signOut(data) {
			var _this = this;

			return new Promise(function (resolve, reject) {
				if (_this.user) {
					_this.user.signOut();
				}
				var email = data.email;
				if (email && typeof email === 'string') {
					_this.getUserByEmail(email).signOut();
				}
				resolve();
			});
		}

		/**
   * SignIn given {email, password}.
   *
   * @param data {email, password}
   * @returns {Promise}
   */

	}, {
		key: 'signIn',
		value: function signIn(data) {
			var _this2 = this;

			return new Promise(function (resolve, reject) {

				var requiredFields = ['email', 'password'],
				    validations = (0, _csApiAuthenticationErrors.validateUserInput)(requiredFields, data);

				if (validations) {
					return reject(validations.messages);
				}

				var email = data.email,
				    password = data.password,
				    user = _this2.getUserByEmail(email),
				    authenticationData = {
					Username: user.getUsername(),
					Password: password
				},
				    authenticationDetails = new _amazonCognitoIdentityJs.AuthenticationDetails(authenticationData);

				user.authenticateUser(authenticationDetails, {
					onSuccess: function onSuccess() {
						user.getUserAttributes(function (err, result) {
							result = result instanceof Array ? result : [];
							var userInfo = result.reduce(function (map, attr) {
								map[(0, _lodash2.default)(attr.Name)] = attr.Value;
								return map;
							}, {});
							resolve(userInfo);
						});
					},
					onFailure: function onFailure(err) {
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
	}, {
		key: 'forgotPassword',
		value: function forgotPassword(data) {
			var _this3 = this;

			return new Promise(function (resolve, reject) {

				var requiredFields = ['email'],
				    validations = (0, _csApiAuthenticationErrors.validateUserInput)(requiredFields, data);

				if (validations) {
					return reject(validations.messages);
				}

				var user = _this3.getUserByEmail(data.email);

				user.forgotPassword({
					onSuccess: function onSuccess(result) {
						var message = void 0;
						if (_ovObjectPath2.default.get(result, 'CodeDeliveryDetails.DeliveryMedium') === 'EMAIL') {
							message = 'A confirmation code was emailed to: ' + result.Destination + '.';
						} else if (_ovObjectPath2.default.get(result, 'CodeDeliveryDetails.DeliveryMedium') === 'SMS') {
							message = 'A confirmation code was SMS messaged to: ' + result.Destination + '.';
						} else {
							message = 'A confirmation code was sent to you.';
						}
						resolve([{ code: 'CodeDeliveryDetails', message: message }]);
					},
					onFailure: function onFailure(err) {
						reject(AuthService.processServiceErrors(err));
					}
				});
			});
		}
	}, {
		key: 'forgotPasswordConfirm',
		value: function forgotPasswordConfirm(data) {
			var _this4 = this;

			return new Promise(function (resolve, reject) {

				var requiredFields = ['code', 'newPassword'],
				    validations = (0, _csApiAuthenticationErrors.validateUserInput)(requiredFields, data);

				if (!_this4.user) {
					requiredFields.push('email');
				}

				if (validations) {
					return reject(validations.messages);
				}

				var email = data.email,
				    code = data.code,
				    newPassword = data.newPassword,
				    user = _this4.user || _this4.getUserByEmail(email);

				user.confirmPassword(code, newPassword, {
					onFailure: function onFailure(err) {
						//{"__type":"CodeMismatchException","message":"Invalid verification code provided, please try
						// again."} {"__type":"InvalidParameterException","message":"1 validation error detected: Value at
						// 'password' failed to satisfy constraint: Member must have length greater than or equal to 6"}
						// {"__type":"ExpiredCodeException","message":"Invalid code provided, please request a code
						// again."}
						return reject(AuthService.processServiceErrors(err));
					},
					onSuccess: function onSuccess(result) {
						resolve(['Your password is updated.']);
					}
				});
			});
		}
	}, {
		key: 'resetPassword',
		value: function resetPassword(data) {
			return this.forgotPassword(data);
		}
	}, {
		key: 'resetPasswordConfirm',
		value: function resetPasswordConfirm(data) {
			return this.forgotPasswordConfirm(data);
		}
	}, {
		key: 'signUp',
		value: function signUp(data) {
			var _this5 = this;

			return new Promise(function (resolve, reject) {

				var requiredFields = ['name', 'email', 'password'],
				    validations = (0, _csApiAuthenticationErrors.validateUserInput)(requiredFields, data);

				if (validations) {
					return reject(validations.messages);
				}

				var name = data.name,
				    email = data.email,
				    password = data.password;

				var attributeList = [];

				if (name) {
					var attributeEmail = new _amazonCognitoIdentityJs.CognitoUserAttribute({
						Name: 'name',
						Value: name
					});
					attributeList.push(attributeEmail);
				}

				if (email) {
					var _attributeEmail = new _amazonCognitoIdentityJs.CognitoUserAttribute({
						Name: 'email',
						Value: email
					});
					attributeList.push(_attributeEmail);
				}

				var username = getUsernameFromEmail(email);

				//http://docs.aws.amazon.com/cognito/latest/developerguide/using-amazon-cognito-user-identity-pools-javascript-examples.html
				_this5.userPool.signUp(username, password, attributeList, null, function (err, result) {
					if (err) {
						return reject(AuthService.processServiceErrors(err));
					}
					resolve([result]);
				});
			});
		}
	}, {
		key: 'signUpConfirm',
		value: function signUpConfirm(data) {
			var _this6 = this;

			return new Promise(function (resolve, reject) {

				var requiredFields = ['email', 'code'],
				    validations = (0, _csApiAuthenticationErrors.validateUserInput)(requiredFields, data);

				if (validations) {
					return reject(validations.messages);
				}

				var email = data.email,
				    code = data.code,
				    user = _this6.getUserByEmail(email);

				user.confirmRegistration(code, true, function (err, result) {
					if (err) {
						return reject(AuthService.processServiceErrors(err));
					}
					var message = 'Your email address is confirmed.';
					resolve([message]);
				});
			});
		}
	}, {
		key: 'resendConfirmationCode',
		value: function resendConfirmationCode(data) {
			var _this7 = this;

			return new Promise(function (resolve, reject) {

				var requiredFields = ['email'],
				    validations = (0, _csApiAuthenticationErrors.validateUserInput)(requiredFields, data);

				if (validations) {
					return reject(validations.messages);
				}

				var email = data.email,
				    user = _this7.getUserByEmail(email);

				user.resendConfirmationCode(function (err, result) {
					if (err) {
						return reject(AuthService.processServiceErrors(err));
					}
					var message = void 0;
					if (_ovObjectPath2.default.get(result, 'CodeDeliveryDetails.DeliveryMedium') === 'EMAIL') {
						message = 'A confirmation code was emailed to: ' + result.Destination + '.';
					} else if (_ovObjectPath2.default.get(result, 'CodeDeliveryDetails.DeliveryMedium') === 'SMS') {
						message = 'A confirmation code was SMS messaged to: ' + result.Destination + '.';
					} else {
						message = 'A confirmation code was sent to you.';
					}
					resolve([{ code: 'CodeDeliveryDetails', message: message }]);
				});
			});
		}
	}, {
		key: 'session',
		get: function get() {
			var _state = this;
			return {
				get loadIdToken() {
					return _state.loadIdToken;
				}
			};
		}
	}, {
		key: 'loadSession',
		get: function get() {
			var _this8 = this;

			return new Promise(function (resolve, reject) {
				if (!_this8.user) {
					return reject(['not signed in']);
				}
				try {
					_this8.user.getSession(function (err, session) {
						if (err) {
							return reject([err]);
						}
						if (!(session && session.isValid())) {
							return reject(['not signed in']);
						}
						return resolve({ session: session });
					});
				} catch (error) {
					reject([error]);
				}
			});
		}
	}, {
		key: 'loadIdToken',
		get: function get() {
			return this.loadSession.then(function (_ref) {
				var session = _ref.session;

				var token = session.getIdToken();
				var expiresOn = token.getExpiration();
				var jwt = token.getJwtToken();
				return { jwt: jwt, expiresOn: expiresOn };
			});
		}
	}, {
		key: 'username',
		get: function get() {
			if (this.user) {
				return this.user.getUsername();
			}
		}
	}, {
		key: 'checkSessionIsValid',
		get: function get() {
			var _this9 = this;

			return new Promise(function (resolve, reject) {
				if (_this9.user) {
					try {
						_this9.user.getSession(function (err, session) {
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
	}, {
		key: 'userPool',
		get: function get() {
			return new _amazonCognitoIdentityJs.CognitoUserPool({
				UserPoolId: this.userPoolId,
				ClientId: this.clientId
			});
		}
	}, {
		key: 'user',
		get: function get() {
			return this.userPool.getCurrentUser();
		}
	}], [{
		key: 'processServiceErrors',
		value: function processServiceErrors(error) {
			console.log('processServiceErrors', error);
			return (0, _csApiAuthenticationErrors.processError)(error);
		}
	}]);

	return AuthService;
}();

exports.default = AuthService;