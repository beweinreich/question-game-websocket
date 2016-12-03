(function() {
	"use strict";
	
	var precondition = require('./contract').precondition;
	
	exports.create = function () {
		return new FakeGameService();
	}; 
	
	function FakeGameService() {
		this._questions = new Rx.Subject();
	}
	
	FakeGameService.prototype.setPlayerName = function (name, callback) {
		this._name = name;
		callback(true);
	};
	
	FakeGameService.prototype.playerName = function () {
		return this._name;
	};
	
	FakeGameService.prototype.sendQuestion = function (question) {
		precondition(_.isString(question), 'Sending a question requires said question');
		
		this._questions.onNext(question);
	};
	
	FakeGameService.prototype.submitAnswer = function (answer, callback) {
		callback(true);
	};
	
	FakeGameService.prototype.questions = function () {
		return this._questions.asObservable();
	};
}());