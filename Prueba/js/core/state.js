const STORAGE_KEY = "bt_hub_v2";

export function seedState() {
    return {
        settings: {
            companyName: "Brianessa Travel | Tu agencia de viajes de confianza",
            phone: "+1 (954) 294-9969",
            email: "BrianessaTravel@gmail.com",
            instagram: "@brianessa",
            facebook: "Brianessa Travel",
            website: "www.brianessatravelboutique.com",
            cardFeePct: 3.5,
            locale: "es-DO",
            currencyDefault: "USD"
        },
        clients: [],
        trips: [],
        paymentPlans: [],
        itineraries: [],
        campaigns: [],
        templates: {
            paymentText: [],
            sms: [],
            emailHtml: [],
            disclaimers: [],
        }
    };
}

export let state = seedState();

export function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            state = seedState();
            return state;
        }
        const parsed = JSON.parse(raw);
        state = { ...seedState(), ...parsed, settings: { ...seedState().settings, ...(parsed.settings || {}) } };
        return state;
    } catch {
        state = seedState();
        return state;
    }
}

export function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Allow external modules to update state reference if needed, ideally modify properties of exported 'state'
export function setState(newState) {
    Object.assign(state, newState);
    saveState();
}

export function refreshTripNames() {
    const map = new Map(state.trips.map(t => [t.id, t.name]));
    state.clients.forEach(c => c.tripName = map.get(c.tripId) || "");
    state.paymentPlans.forEach(p => p.tripName = map.get(p.tripId) || "");
    state.itineraries.forEach(i => i.tripName = map.get(i.tripId) || "");
}
