(function() {
	"use strict";
	
	exports.create = function () {
		// TODO it will have the real socket
		return new GameService();
	}; 
	
	function GameService() {
		this._questions = new Rx.Subject();
	}
	
	GameService.prototype.questions = function () {
		return this._questions.asObservable();
	};
	
	GameService.prototype.setPlayerName = function (name, callback) {
	};
	
	GameService.prototype.submitAnswer = function (answer, callback) {
		
	};
}());