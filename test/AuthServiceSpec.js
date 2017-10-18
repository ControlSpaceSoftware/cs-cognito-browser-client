/*global describe, it, beforeEach*/

import chai from 'chai'
import sinon from 'sinon'
import sinonChai from 'sinon-chai'

import {AuthService} from '../src/index'

chai.should();
chai.use(sinonChai);

const expect = chai.expect;

describe('AuthService', () => {

	let clientId, userPoolId;

	beforeEach(() => {
		clientId = 'clientId';
		userPoolId = 'userPoolId';
	});

	it('exits', () => {
		expect(AuthService).not.undefined;
	});

});
