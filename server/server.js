var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var program = require('commander');
var _ = require('underscore');
var fs = require('fs');

var PORT = 3000;

var POINTS_FOR_TRUTH = 1000;
var POINTS_FOR_LIE = 500;

var TIME_BETWEEN_RESULTS = 5000;
var TIME_AFTER_SCORES = 5000;
var SECONDS_BEFORE_START = 5;

var countdownObject = {};
var resultCooldownTimer = null;
var scoreCooldownTimer = null;
var players = {};
var questionIndex = 0;

// TODO : replace these variables with a state variable
// BEFORE, STARTING, STARTED, ENDED, and eventually PAUSED, but for now quitting stops the game and doesn't pause
var gameStarted = false;
var gameEnded = false;

program
	.version('0.1')
	.option('-w, --webclient <directory>', 'The directory served')
	.option('-q, --question <file>', 'The question file')
	.parse(process.argv);
	
fs.readFile(program.question, 'utf-8', function (err, data) {
	if (err) {
		console.log('Could not read question file');
		return;
	}
	
	app.use(express.static(program.webclient));
	io.on('connection', onConnect(JSON.parse(data)));
});

function onConnect(questions) {
	return function (socket) {
		socket.on('name', onPlayerName(socket));
		socket.on('start', onStart(socket, questions));
		socket.on('cancel', onCancel(socket));
		socket.on('answer', onAnswer(socket, questions));
		socket.on('choice', onChoice(socket, questions));
		socket.on('disconnect', onDisconnect(socket));
	};
}

function onPlayerName(socket) {
	return function (name) {
		if (gameStarted) {
			socket.emit('name response', false, 'ALREADY_STARTED');
			return;
		}
		
		var names = _.map(players, function (player) {
			return player.name;
		});
		if (_.contains(names, name)) {
			socket.emit('name response', false, 'EXISTING');
		} else {
			console.log('A user identified as [' + name + "]");
			players[socket.id] = {
				name: name,
				score: 0,
				lastAnswer: null,
				lastChoice: null
			};
			socket.emit('name response', true);
			var names = _.map(players, function (player) {
				return player.name;
			});
			io.emit('players', names);
		}
	};
}

function onStart(socket, questions) {
	return function () {
		if (!players[socket.id]) {
			console.log('Game cannot be started by a player who is not logged in');
			return;
		}
		
		console.log('Game started by [' + players[socket.id].name + ']');
		countdown(countdownObject, SECONDS_BEFORE_START, function () {
			gameStarted = true;
			console.log('Game start, sending first question');
			io.emit('question', questions[0].question, 1, questions.length);
		});
	};
}

function onCancel(socket) {
	return function () {
		if (!players[socket.id]) {
			console.log('Game cannot be cancelled by a user who is not logged in');
			return
		}
		
		if (countdownObject.timer) {
			console.log('Game start cancelled by [' + players[socket.id].name + ']');
			clearTimeout(countdownObject.timer);
			countdownObject.timer = null;
			
			var names = _.map(players, function (player) {
				return player.name;
			});
			io.emit('players', names);
		}
	};
}

function onAnswer(socket, questions) {
	return function (answer) {
		if (!players[socket.id]) {
			console.log('Question cannot be answered by a user who is not logged in');
			return;
		}
		
		var truth = questions[questionIndex].answer;
		if (answer === truth) {
			socket.emit('answer response', false, 'TRUTH');
		} else {
			console.log('Player [' + players[socket.id].name + '] has answered ' + answer);
			players[socket.id].lastAnswer = answer;
			socket.emit('answer response', true);
			if (hasEveryPlayerAnswered()) {
				var choices = computeChoices(truth);
				shuffle(choices);
				console.log('Everybody has answered, sending choices : ' + JSON.stringify(choices));
				io.emit('choices', choices);
			}
		}
	};
}

function onChoice(socket, questions) {
	return function (choice) {
		if (!players[socket.id]) {
			console.log('A choice cannot be made by a player who is not logged in');
			return;
		}
		
		console.log('Player [' + players[socket.id].name + '] has choosen ' + choice);
		players[socket.id].lastChoice = choice;
		if (hasEveryPlayerChosen()) {
			console.log('Everybody has chosen, computing scores');
			
			var truth = questions[questionIndex].answer;
			var resultsMap = {};
			resultsMap[truth] = { authors: ['TRUTH'], choosedBy: []};
			
			_.each(players, function (player) {
				resultsMap[player.lastAnswer] = getResult(resultsMap, player);
			});
			
			_.each(players, function (player) {
				// If choice is the truth, give 1000 points to that player
				// and add that player in its list of choosers
				if (player.lastChoice === truth) {
					player.score += POINTS_FOR_TRUTH;
					resultsMap[truth].choosedBy.push(player.name);
				} else {
					// Otherwise, find out who created the choice and give each author 500 points
					_.each(players, function (potentialAuthor) {
						// Do not give points to a player who picks his own answer
						if (potentialAuthor.name !== player.name && potentialAuthor.lastAnswer === player.lastChoice) {
							potentialAuthor.score += POINTS_FOR_LIE;
							
						}
					});
					// and add this player to the list of choosers of that choice
					resultsMap[player.lastChoice].choosedBy.push(player.name);
				}
			});
			
			resultsMap = removeUnpickedChoices(resultsMap, truth);
			var results = placeResultsIntoArray(resultsMap, truth);
			
			sendResultsOneByOne(0, results, function () {
				console.log(scoresArray());
				questionIndex++;
				var isFinal = (questionIndex === questions.length);
				io.emit('scores', scoresArray(), isFinal);
				
				var scoreCooldownTimer = setTimeout(function () {
					if (questionIndex < questions.length) {
						console.log('Sending next question');
						resetAnswers();
						io.emit('question', questions[questionIndex].question, questionIndex + 1, questions.length);
					} else {
						console.log('Game finished, no more questions');
						gameEnded = true;
					}
				}, TIME_AFTER_SCORES);
			});
		}
	};
}

/**
 * Shuffles array in place.
 * @param {Array} a items The array containing the items.
 */
function shuffle(a) {
    var j, x, i;
    for (i = a.length; i; i--) {
        j = Math.floor(Math.random() * i);
        x = a[i - 1];
        a[i - 1] = a[j];
        a[j] = x;
    }
}

function sendResultsOneByOne(index, results, callback) {
	if (index === results.length) {
		console.log('No more results to send');
		callback();
		return;
	}
	
	console.log('Sending result : ' + JSON.stringify(results[index]));
	io.emit('result', results[index]);
	
	resultCooldownTimer = setTimeout(function () {
		sendResultsOneByOne(index + 1, results, callback);
	}, TIME_BETWEEN_RESULTS);
}

function placeResultsIntoArray(resultsMap, truth) {
	var results = [];
	_.each(_.keys(resultsMap), function (choice) {
		if (resultsMap[choice].authors[0] !== 'TRUTH') {
			results.push({
				choice: choice,
				authors: resultsMap[choice].authors,
				choosedBy: resultsMap[choice].choosedBy
			});
		}
	});
	// Insert truth at the end
	results.push({
		choice: truth,
		authors: ['TRUTH'], 
		choosedBy: resultsMap[truth].choosedBy
	});
	return results;
}

function removeUnpickedChoices(resultsMap, truth) {
	var newResultsMap = {};
	_.each(_.keys(resultsMap), function (choice) {
		if (choice === truth || (choice !== truth && resultsMap[choice].choosedBy.length > 0)) {
			newResultsMap[choice] = resultsMap[choice];
		}
	});
	return newResultsMap;
}

function getResult(resultsMap, player) {
	if (resultsMap[player.lastAnswer]) {
		var result = resultsMap[player.lastAnswer];
		result.authors.push(player.name);
		return result;
	}
	
	return {authors: [player.name], choosedBy:[]};
}

function scoresArray() {
	return _.map(players, function (player) {
		return {
			name: player.name,
			score: player.score
		};
	});
}

function onDisconnect(socket) {
	return function () {
		if (players[socket.id]) {
			console.log('Player [' + players[socket.id].name + '] has left');
			if ((countdownObject.timer || gameStarted) && !gameEnded) {
				clearGameTimers();
				gameEnded = true;
				io.emit('quit', players[socket.id].name);
			}
			
			delete players[socket.id];
			
			if (!gameStarted && !gameEnded) {
				var names = _.map(players, function (player) {
					return player.name;
				});
				io.emit('players', names);
			}
		}
	};
}


function clearGameTimers() {
	if (countdownObject.timer) {
		clearTimeout(countdownObject.timer);
		countdownObject.timer = null;
	}
	if (resultCooldownTimer) {
		clearTimeout(resultCooldownTimer);
		resultCooldownTimer = null;
	}
	if (scoreCooldownTimer) {
		clearTimeout(scoreCooldownTimer);
		scoreCooldownTimer = null;
	}
}

function resetAnswers() {
	_.each(players, function (player) {
		player.lastAnswer = null;
		player.lastChoice = null;
	});
}

function computeChoices(truth) {
	var answers = _.map(players, function (player) {
		return player.lastAnswer;
	});
	
	return _.uniq(answers).concat([truth]);
}

function hasEveryPlayerChosen() {
	return _.every(players, function (player) {
		return player.lastChoice != null;
	});
}

function hasEveryPlayerAnswered() {
	return _.every(players, function (player) {
		return player.lastAnswer != null;
	});
}

function countdown(countdownObject, seconds, callback) {
	console.log('starting in ' + seconds + ' seconds');
	io.emit('starting', seconds);
	if (seconds === 0) {
		countdownObject.timer = null;
		callback();
		return;
	}
	
	countdownObject.timer = setTimeout(function () {
		countdown(countdownObject, seconds - 1, callback);
	}, 1000);
}

http.listen(PORT, function () {
	console.log('Question game server listening on port ' + PORT);
});
