var _a;
import { broadcast, isHost, message, peer, users } from "./networking.js";
import { updatePlayPanel } from "./ui.js";
let GameSettings = {
    startingCards: 7,
    maxPlayers: -1,
    verifiers: new Set()
};
export let deck;
export let gameUser;
export let otherGameUsers = new Map(); //only init if host
export let gamePeers = new Map(); //only init if client
export let turn;
const CONST_VERIFIERS = {
    RANGE_RUN: (min, max) => {
        return {
            check: (action) => {
                let actionCardsCopy = [...action.cards];
                if (max < 0) {
                    max = action.cards.length;
                }
                return actionCardsCopy.length >= min && actionCardsCopy.length <= max && actionCardsCopy.sort((a, b) => a.valueAsNumber - b.valueAsNumber).every((curr, i, array) => {
                    return array[i - 1] ? curr.valueAsNumber - array[i - 1].valueAsNumber == 1 : true;
                });
            }
        };
    },
    SUITED_RANGE_RUN: (min, max) => {
        return {
            check: (action) => {
                return CONST_VERIFIERS.RANGE_RUN(min, max).check(action) && action.cards.every(c => c.suit == action.cards[0].suit);
            }
        };
    },
    OF_A_KIND: (size) => {
        return {
            check: (action) => {
                return action.cards.length == size && action.cards.every(c => c.valueAsNumber == action.cards[0].valueAsNumber);
            }
        };
    },
    RANGE_OF_A_KIND: (min, max) => {
        return {
            check: (action) => {
                if (max < 0) {
                    max = action.cards.length;
                }
                return action.cards.length >= min && action.cards.length <= max && action.cards.every(c => c.valueAsNumber == action.cards[0].valueAsNumber);
            }
        };
    },
    SINGLE_CARD: {
        check: (action) => {
            return action.cards.length == 1;
        }
    }
};
class Card {
    constructor(value, suit) {
        this.suit = suit;
        this.value = value;
    }
    get toString() {
        return this.value + this.suit;
    }
    compareTo(card) {
        return this.sortingValue - card.sortingValue;
    }
    get sortingValue() {
        return this.valueAsNumber + 13 * Card.suits.indexOf(this.suit);
    }
    get valueAsNumber() {
        return Card.values.indexOf(this.value);
    }
    static parseCard(card) {
        let value = card.charAt(0);
        let suit = card.charAt(1);
        return new Card(value, suit);
    }
}
Card.suits = ["S", "C", "H", "D"];
Card.values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K"];
class Deck {
    constructor() {
        this.cards = [];
    }
    set addCard(card) {
        this.cards.push(card);
    }
    static get createDeck() {
        let newDeck = new _a();
        Card.suits.forEach(s => {
            Card.values.forEach(v => {
                newDeck.addCard = new Card(v, s);
            });
        });
        return newDeck;
    }
    get size() {
        return this.cards.length;
    }
    drawCard(n) {
        if (n > this.size) {
            throw Error("Illegal draw, deck had " + this.size + " cards but tried to draw " + n + " cards.");
        }
        return [...Array(n)].map(n => this.cards.pop());
    }
}
_a = Deck;
(() => {
    _a.standardDeck = new _a();
    Card.suits.forEach(s => {
        Card.values.forEach(v => {
            _a.standardDeck.addCard = new Card(v, s);
        });
    });
})();
export class Action {
    constructor(cards, user) {
        this.cards = cards;
        this.source = user;
    }
}
class GameUser {
    constructor(user) {
        this.toJSON = () => {
            let result = {};
            for (var key in this) {
                if (key !== "peer") {
                    result[key] = this[key];
                }
            }
            return result;
        };
        this.user = user;
        this.peer = new GamePeer(user);
        this.hand = [];
    }
    addToHand(...cards) {
        this.hand = this.hand.concat(cards);
        this.peer.handSize += cards.length;
    }
    playCards(...cards) {
        cards.reverse().forEach(c => {
            if (c > this.hand.length) {
                throw Error("Illegal play of card, index out of bounds");
            }
            this.hand.splice(c, 1);
            this.peer.handSize -= 1;
        });
    }
}
class GamePeer {
    constructor(user) {
        this.user = user;
        this.handSize = 0;
    }
}
export function initGame() {
    // create deck
    if (isHost) {
        deck = Deck.createDeck;
        turn = [...users.entries()][1][0];
    }
    // verifiers
    GameSettings.verifiers.add(CONST_VERIFIERS.RANGE_RUN(3, -1));
    GameSettings.verifiers.add(CONST_VERIFIERS.SINGLE_CARD);
    GameSettings.verifiers.add(CONST_VERIFIERS.RANGE_OF_A_KIND(2, -1));
    // create game user
    gameUser = new GameUser(users.get(peer.id));
    // create game peers if client or game users if host
    [...users].forEach(([_, u]) => {
        if (u.id == peer.id) {
            return;
        }
        if (isHost) {
            otherGameUsers.set(u.id, new GameUser(u));
        }
        else {
            gamePeers.set(u.id, new GamePeer(u));
        }
    });
    // create game settings if not default
    //TODO
    // send out hand updates
    if (isHost) {
        distributeCards();
        updatePlayPanel();
        sendGameUpdate();
    }
}
// run only by host
function distributeCards() {
    if (!isHost) {
        throw Error("Illegal client access to distributeCards()");
    }
    [...Array(Math.min(GameSettings.startingCards * users.size, deck.size))].forEach((_, i) => {
        [...otherGameUsers.entries()].map(([_, v]) => v).concat(gameUser)[i % users.size].addToHand(deck.drawCard(1)[0]);
    });
}
// run only by host
export function runAction(cardIndices, source) {
    console.log(cardIndices);
    let user;
    if (source == peer.id) {
        user = gameUser;
    }
    else {
        user = otherGameUsers.get(source);
    }
    let action = new Action(cardIndices.map(c => user.hand[c]), user);
    if (turn != source || ![...GameSettings.verifiers.entries()].some(([v, _]) => v.check(action))) {
        throw Error("Illegal play from " + users.get(source));
    }
    console.log(action.cards);
    user.playCards(...cardIndices);
}
export function nextTurn() {
    let userArray = [...users.entries()].map(([k, _]) => k);
    turn = userArray[(userArray.indexOf(turn) + 1) % userArray.length];
}
// game networking
export function sendPlay(cardIndices) {
    let action = new Action(cardIndices.map(c => gameUser.hand[c]), gameUser);
    if (turn != peer.id || ![...GameSettings.verifiers.entries()].some(([v, _]) => v.check(action)))
        return false;
    let data = {
        source: peer.id,
        type: "play",
        value: JSON.stringify(cardIndices)
    };
    broadcast(data);
    return true;
}
// only run by host
export function sendGameUpdate() {
    if (!isHost) {
        throw Error("Illegal client access to sendGameUpdate()");
    }
    [...otherGameUsers.entries()].map(([_, v]) => v).forEach((u, i, others) => {
        let gameUpdate = {
            user: u,
            peers: [...others].slice(i, i + 1).map(v => v.peer),
            turn: turn
        };
        let data = {
            source: peer.id,
            type: "gameUpdate",
            value: JSON.stringify(gameUpdate)
        };
        message(data, u.user);
    });
}
export function readGameUpdate(data) {
    gameUser.hand = data.user.hand.map(c => new Card(c.value, c.suit));
    gameUser.peer.handSize = data.user.hand.length;
    gamePeers = new Map(data.peers.map(p => [p.user.id, p]));
    turn = data.turn;
    updatePlayPanel();
}
