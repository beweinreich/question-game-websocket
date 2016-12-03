(function() {
	"use strict";
	
	var i18n = require('./i18n').i18n();
	var precondition = require('./contract').precondition;
	
	exports.render = function (container, task) {
		precondition(container, 'Game widget requires a container');
		precondition(task, 'Game widget requires a game task');
		
		
		var widgetContainer = d3.select(container[0]).append('div');
		
		task.status().subscribe(function (status) {
			widgetContainer.selectAll('*').remove();
			status.match({
				initial: showPlayerLogin(widgetContainer, task),
				before: showStartButton(widgetContainer, task),
				starting: showStartingControls(widgetContainer, task),
				question: showQuestion(widgetContainer, task),
				waiting: showWaiting(widgetContainer)
			});
		});
	};
	
	function showPlayerLogin(widgetContainer, task) {
		return function () {
			var txtPlayerName = widgetContainer.append('input')
				.attr({
					type: 'text',
					placeholder: i18n.PLAYER_NAME_CUE
				})
				.classed('txt-player-name', true);
				
			widgetContainer.append('button')
				.classed('btn-join-game', true)
				.text(i18n.JOIN_GAME)
				.on('click', function () {
					var playerName = $(txtPlayerName[0]).val();
					task.setPlayerName(playerName);
				});
		};
	}
	
	function showStartButton(widgetContainer, task) {
		return function () {
			widgetContainer.append('button')
				.classed('btn-start-game', true)
				.text(i18n.START_GAME)
				.on('click', function () {
					task.startGame();
				});
		};
	}
	
	function showStartingControls(widgetContainer, task) {
		return function (secondsRemaining) {
			widgetContainer.append('p')
				.classed('game-starting', true)
				.text(i18n.STARTING_SOON.replace('{seconds}', secondsRemaining));
			
			widgetContainer.append('button')
				.classed('btn-cancel', true)
				.text(i18n.CANCEL)
				.on('click', function () {
					task.cancelStart();
				});
		};
	}
	
	function showQuestion(widgetContainer, task) {
		return function (question) {
			widgetContainer.append('p')
				.classed('question', true)
				.text(question);
				
			var txtAnswer = widgetContainer.append('input')
				.attr({
					type: 'text',
					placeholder: i18n.ANSWER_CUE
				})
				.classed('txt-answer', true);
				
			widgetContainer.append('button')
				.classed('btn-submit-answer', true)
				.text(i18n.SUBMIT_ANSWER)
				.on('click', function () {
					var answer = $(txtAnswer[0]).val();
					task.submitAnswer(answer);
				});
		};
	}
	
	function showWaiting(widgetContainer) {
		return function () {
			widgetContainer.append('p')
				.classed('waiting', true)
				.text(i18n.WAITING);
		};
	}
}());