(function() {
	"use strict";
	
	var precondition = require('./contract').precondition;
	
	exports.create = function () {
		return new FakeGameService();
	}; 
	
	function FakeGameService() {
		this._starting = new Rx.Subject();
		this._questions = new Rx.Subject();
		this._choices = new Rx.Subject();
		this._results = new Rx.Subject();
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
	
	FakeGameService.prototype.sendChoices = function (choices) {
		this._choices.onNext(choices);
	};
	
	FakeGameService.prototype.sendResults = function (results) {
		this._results.onNext(results);
	};
	
	FakeGameService.prototype.startGame = function () {
		this._starting.onNext(5);
	};
	
	FakeGameService.prototype.submitAnswer = function (answer, callback) {
		callback(true);
	};
	
	FakeGameService.prototype.submitChoice = function (choiceIndex) {
		// Do nothing.
	};
	
	FakeGameService.prototype.starting = function () {
		return this._starting.asObservable();
	};
	
	FakeGameService.prototype.questions = function () {
		return this._questions.asObservable();
	};
	
	FakeGameService.prototype.choices = function () {
		return this._choices.asObservable();
	};
	
	FakeGameService.prototype.results = function () {
		return this._results.asObservable();
	};
}());