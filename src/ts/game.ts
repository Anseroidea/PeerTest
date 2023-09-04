import { DataMessage, User, broadcast, isHost, message, peer, users } from "./networking.js";
import { updatePlayPanel } from "./ui.js";

let GameSettings = {
    startingCards: 7,
    maxPlayers: -1,
    verifiers: new Set() as Set<Verifier>
}
export let deck: Deck
export let gameUser: GameUser;
export let otherGameUsers: Map<string, GameUser> = new Map() ; //only init if host
export let gamePeers: Map<string, GamePeer> = new Map(); //only init if client
export let turn: string;
export type GameUpdate = {
    user: GameUser,
    peers: GamePeer[],
    turn: string
}

const CONST_VERIFIERS = {
    RANGE_RUN: (min: number, max: number) => {
        return {
            check: (action: Action) => {
                let actionCardsCopy: Card[] = [...action.cards]
                if (max < 0) {
                    max = action.cards.length
                }
                return actionCardsCopy.length >= min && actionCardsCopy.length <= max && actionCardsCopy.sort((a, b) => a.valueAsNumber - b.valueAsNumber).every((curr, i, array) => {
                    return array[i - 1] ? curr.valueAsNumber - array[i-1].valueAsNumber == 1: true
                })   
            }
        } as Verifier
    },
    SUITED_RANGE_RUN: (min: number, max: number) => {
        return {
            check: (action: Action) => {
                return CONST_VERIFIERS.RANGE_RUN(min, max).check(action) && action.cards.every(c => c.suit == action.cards[0].suit)
            }
        } as Verifier
    },
    OF_A_KIND: (size: number): Verifier => {
        return {
            check: (action: Action) => {
                return action.cards.length == size && action.cards.every(c => c.valueAsNumber == action.cards[0].valueAsNumber)       
            }
        } as Verifier
    },
    RANGE_OF_A_KIND: (min: number, max: number) => {
        return {
            check: (action: Action) => {
                if (max < 0) {
                    max = action.cards.length
                }
                return action.cards.length >= min && action.cards.length <= max && action.cards.every(c => c.valueAsNumber == action.cards[0].valueAsNumber)       
            }
        } as Verifier
    },
    SINGLE_CARD: { 
        check: (action: Action) => {
            return action.cards.length == 1; 
        }
    }
}

class Card {
    
    suit: typeof Card.suits[number];
    value: typeof Card.values[number];

    static suits = ["S", "C", "H", "D"] as const
    static values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K"] as const

    constructor(value: typeof Card.values[number], suit: typeof Card.suits[number]) {
        this.suit = suit
        this.value = value
    }

    get toString(): string {
        return this.value + this.suit
    }

    compareTo(card: Card): number {
        return this.sortingValue - card.sortingValue;
    }

    get sortingValue(): number {
        return this.valueAsNumber + 13 * Card.suits.indexOf(this.suit)
    }

    get valueAsNumber(): number {
        return Card.values.indexOf(this.value);
    }

    static parseCard(card: string): Card {
        let value = card.charAt(0) as typeof this.values[number]
        let suit = card.charAt(1) as typeof this.suits[number]
        return new Card(value, suit)
    }

}

class Deck {

    cards: Card[];

    constructor() {
        this.cards = []
    }

    public set addCard(card: Card){
        this.cards.push(card)
    }

    private static standardDeck: Deck;

    static {
        this.standardDeck = new Deck();
        Card.suits.forEach(s => {
            Card.values.forEach(v => {
                this.standardDeck.addCard = new Card(v, s);
            })
        })
    }

    public static get createDeck(): Deck {
        let newDeck = new Deck()
        Card.suits.forEach(s => {
            Card.values.forEach(v => {
                newDeck.addCard = new Card(v, s);
            })
        })
        return newDeck;
    }

    get size(): number {
        return this.cards.length
    }

    drawCard(n: number): Card[] {
        if (n > this.size) {
            throw Error("Illegal draw, deck had " + this.size + " cards but tried to draw " + n + " cards.")
        }
        return [...Array(n)].map(n => this.cards.pop())
    }

}

export class Action {

    cards: Card[]
    source: GameUser

    constructor(cards: Card[], user: GameUser) {
        this.cards = cards;
        this.source = user;
    }

}

interface Verifier {

    check(action: Action): boolean

}

class GameUser {

    user: User
    peer: GamePeer
    hand: Card[]

    constructor(user: User){
        this.user = user
        this.peer = new GamePeer(user)
        this.hand = []
    }

    addToHand(...cards: Card[]) {
        this.hand = this.hand.concat(cards)
        this.peer.handSize += cards.length
    }

    toJSON = () => {
        let result: any = {}
        for (var key in this) {
            if (key !== "peer") {
                result[key] = this[key]
            }
        }
        return result
    }

    playCards(...cards: number[]) {
        cards.reverse().forEach(c => {
            if (c > this.hand.length) {
                throw Error("Illegal play of card, index out of bounds")
            }
            this.hand.splice(c, 1)
            this.peer.handSize -= 1
        })
    }

}

class GamePeer {

    user: User
    handSize: number

    constructor(user: User) {
        this.user = user
        this.handSize = 0;
    }

}


export function initGame() {
    // create deck
    if (isHost) {
        deck = Deck.createDeck
        turn = [...users.entries()][1][0]
    }
    // verifiers
    GameSettings.verifiers.add(CONST_VERIFIERS.RANGE_RUN(3, -1))
    GameSettings.verifiers.add(CONST_VERIFIERS.SINGLE_CARD)
    GameSettings.verifiers.add(CONST_VERIFIERS.RANGE_OF_A_KIND(2, -1))
    // create game user
    gameUser = new GameUser(users.get(peer.id));
    // create game peers if client or game users if host
    [...users].forEach(([_, u]) => {
        if (u.id == peer.id){
            return
        }
        if (isHost) {
            otherGameUsers.set(u.id, new GameUser(u))
        } else {
            gamePeers.set(u.id, new GamePeer(u))
        }
    })

    // create game settings if not default
    //TODO

    // send out hand updates
    if (isHost) {
        distributeCards()
        updatePlayPanel()
        sendGameUpdate()
    }
}

// run only by host
function distributeCards() {
    if (!isHost) {
        throw Error("Illegal client access to distributeCards()")
    }
    [...Array(Math.min(GameSettings.startingCards * users.size, deck.size))].forEach((_, i) => {
        [...otherGameUsers.entries()].map(([_, v]) => v).concat(gameUser)[i % users.size].addToHand(deck.drawCard(1)[0])
    })
}

// run only by host
export function runAction(cardIndices: number[], source: string) {
    console.log(cardIndices)
    let user: GameUser;
    if (source == peer.id) {
        user = gameUser
    } else {
        user = otherGameUsers.get(source)
    }
    let action: Action = new Action(cardIndices.map(c => user.hand[c]), user)
    if (turn != source || ![...GameSettings.verifiers.entries()].some(([v, _]) => v.check(action)))  {
        throw Error("Illegal play from " + users.get(source))
    }
    console.log(action.cards)
    user.playCards(...cardIndices)
}

export function nextTurn() {
    let userArray = [...users.entries()].map(([k, _]) => k)
    turn = userArray[(userArray.indexOf(turn) + 1) % userArray.length]
}

// game networking

export function sendPlay(cardIndices: number[]){ 
    let action: Action = new Action(cardIndices.map(c => gameUser.hand[c]), gameUser)
    if (turn != peer.id || ![...GameSettings.verifiers.entries()].some(([v, _]) => v.check(action))) 
        return false
    let data: DataMessage = {
        source: peer.id,
        type: "play",
        value: JSON.stringify(cardIndices)
    }
    broadcast(data)
    return true
}

// only run by host
export function sendGameUpdate() {
    if (!isHost) {
        throw Error("Illegal client access to sendGameUpdate()")
    }
    [...otherGameUsers.entries()].map(([_, v]) => v).forEach((u, i, others) => {
        let gameUpdate : GameUpdate = {
            user: u,
            peers: [...others].slice(i, i + 1).map(v => v.peer),
            turn: turn
        }
        let data: DataMessage = {
            source: peer.id,
            type: "gameUpdate",
            value: JSON.stringify(gameUpdate)
        }
        message(data, u.user)
    }) 
}

export function readGameUpdate(data: GameUpdate) {
    gameUser.hand = data.user.hand.map(c => new Card(c.value, c.suit))
    gameUser.peer.handSize = data.user.hand.length
    gamePeers = new Map(data.peers.map(p => [p.user.id, p]))
    turn = data.turn
    updatePlayPanel()
}


