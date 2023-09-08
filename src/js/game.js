var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _Pile_remover, _a;
import { broadcast, isHost, message, peer, users } from "./networking.js";
import { updatePlayPanel } from "./ui.js";
let GameSettings = {
    startingCards: 7,
    maxPlayers: -1,
    verifiers: new Set(),
    playToDiscard: true
};
export let deck;
export let gameUser;
export let otherGameUsers = new Map(); //only init if host
export let gamePeers = new Map(); //only init if client
export let turn;
let piles = new Map();
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
class Pile {
    constructor(name, settings) {
        _Pile_remover.set(this, void 0);
        this.name = name;
        this.settings = settings;
        if (settings.behavior == "QUEUE") {
            __classPrivateFieldSet(this, _Pile_remover, () => {
                return this.pile.shift();
            }, "f");
        }
        else {
            __classPrivateFieldSet(this, _Pile_remover, () => {
                return this.pile.pop();
            }, "f");
        }
    }
    addCards(...cards) {
        this.pile = this.pile.concat(cards);
    }
    removeCards(n) {
        if (n > this.pile.length) {
            throw Error("Illegal draw, pile " + this.name + " had " + this.pile.length + " cards but tried to draw " + n + " cards.");
        }
        return [...Array(n)].map(n => __classPrivateFieldGet(this, _Pile_remover, "f").call(this));
    }
    static get DEFAULT_DRAW() {
        return {
            topVisible: -1,
            behavior: "QUEUE",
            showFaces: false
        };
    }
    get size() {
        return this.pile.length;
    }
}
_Pile_remover = new WeakMap();
class Deck extends Pile {
    constructor() {
        super("deck", Pile.DEFAULT_DRAW);
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
        return cards.reverse().map(c => {
            if (c > this.hand.length) {
                throw Error("Illegal play of card, index out of bounds");
            }
            this.peer.handSize -= 1;
            return this.hand.splice(c, 1)[0];
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
    let drawnCard = deck.drawCard(1)[0];
    let discard = new Pile("discard", {
        topVisible: 1,
        behavior: "STACK",
        showFaces: true
    });
    discard.addCards(drawnCard);
    piles.set("draw", deck);
    piles.set("discard", discard);
    //DISCARD and DRAW are reserved pile names
    //DISCARD refers to a pile of cards of which players can/need to add cards to
    //DRAW refers to a pile of cards of which players can/need to remove cards from
    //DRAw by default refers to the deck
}
// run only by host
function playerDraw(source) {
    if (!isHost) {
        throw Error("Illegal client access to playerDraw()");
    }
    let user;
    if (source == peer.id) {
        user = gameUser;
    }
    else {
        user = otherGameUsers.get(source);
    }
    if (deck.size == 0) {
        return false;
    }
    else {
        let card = deck.removeCards(1)[0];
        user.addToHand(card);
        return true;
    }
}
// run only by host
function runPlayerRemoveFromPile(source, pileStr, num) {
    if (!isHost) {
        throw Error("Illegal client access to runPlayerPileEdit()");
    }
    let pile = piles.get(pileStr);
    if (piles.get(pileStr) == undefined) {
        throw Error("Nonexistent pile " + pileStr + "requested");
    }
    let user;
    if (source == peer.id) {
        user = gameUser;
    }
    else {
        user = otherGameUsers.get(source);
    }
    if (pile.size == 0) {
        return false;
    }
    else {
        let cards = deck.removeCards(num);
        user.addToHand(...cards);
        return true;
    }
}
// run only by host
function runPlayerAddToPile(source, pileStr, cardIndices) {
    if (!isHost) {
        throw Error("Illegal client access to runPlayerPileEdit()");
    }
    let pile = piles.get(pileStr);
    if (piles.get(pileStr) == undefined) {
        throw Error("Nonexistent pile " + pileStr + "requested");
    }
    let user;
    if (source == peer.id) {
        user = gameUser;
    }
    else {
        user = otherGameUsers.get(source);
    }
    if (user.hand.length < cardIndices.length) {
        return false;
    }
    let convertedCards = user.playCards(...cardIndices);
    pile.addCards(...convertedCards);
    return true;
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
    let cards = user.playCards(...cardIndices);
    if (GameSettings.playToDiscard)
        piles.get("discard").addCards(...cards);
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
    let pileData = [...piles.entries()].map(p => {
        let pileSettings = p[1].settings;
        let cards;
        if (pileSettings.topVisible < 0) {
            cards = p[1].pile;
        }
        else {
            if (pileSettings.behavior == "QUEUE") {
                cards = p[1].pile.slice(0, pileSettings.topVisible);
            }
            else {
                cards = p[1].pile.slice(-pileSettings.topVisible);
            }
        }
        if (!pileSettings.showFaces) {
            cards = cards.map(c => undefined);
        }
        return [p[0], cards];
    });
    [...otherGameUsers.entries()].map(([_, v]) => v).forEach((u, i, others) => {
        let gameUpdate = {
            user: u,
            peers: [...others].slice(i, i + 1).map(v => v.peer),
            piles: pileData,
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
    piles = new Map(data.piles.map(p => {
        let pileSettings = {
            topVisible: -1,
            behavior: "QUEUE",
            showFaces: p[1][0] === undefined
        };
        let pile = new Pile(p[0], pileSettings); // these are just display
        pile.addCards(...p[1]);
        return [p[0], pile];
    }));
    turn = data.turn;
    updatePlayPanel();
}
export function requestAddToPile(pile, num) {
    let data = {
        source: peer.id,
        type: ""
    };
}
export function requestRemoveFromPile(pile, num) {
}
