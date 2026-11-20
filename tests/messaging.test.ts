import { describe, expect, it } from "vitest";
import { formatForChannel, freshnessLabel, say } from "../src/worker/messaging/copy";
import { mergeNeed, parseModelJson } from "../src/worker/messaging/extract";
import {
  detectLanguage,
  keyword,
  looksLikeNeed,
  matchPlace,
  parseBloodGroup,
  parseComponent,
  parseLanguageChoice,
  parseNeed,
  parseUnits,
  parseUrgency,
  type Place,
} from "../src/worker/messaging/parse";
import { isWhatsAppGroup, maskAddress, normalizeAddress, normalizePhone, smsCapable } from "../src/worker/messaging/phone";

const PLACES: Place[] = [
  { id: "sion", name: "Sion", kind: "area", lat: 19.04, lng: 72.86 },
  { id: "dadar", name: "Dadar", kind: "area", lat: 19.02, lng: 72.84 },
  { id: "andheri", name: "Andheri", kind: "area", lat: 19.12, lng: 72.85 },
  { id: "mumbai-central", name: "Mumbai Central", kind: "area", lat: 18.97, lng: 72.82 },
  { id: "hsp-sion-ltmgh", name: "Lokmanya Tilak Hospital", kind: "hospital", lat: 19.039, lng: 72.862, aliases: ["Lokmanya Tilak", "Sion hospital"] },
  { id: "hsp-nair-mumbai-central", name: "Nair Hospital", kind: "hospital", lat: 18.97, lng: 72.82, aliases: ["Nair", "Mumbai Central hospital"] },
];

describe("phone normaliser (E.164, India default)", () => {
  it.each([
    ["9820012345", "+919820012345"],
    ["98200 12345", "+919820012345"],
    ["+91 98200-12345", "+919820012345"],
    ["098200 12345", "+919820012345"],
    ["919820012345", "+919820012345"],
    ["0091 98200 12345", "+919820012345"],
    ["(022) 2412 3456", "+912224123456"],
    ["919820012345@c.us", "+919820012345"],
    ["whatsapp:+919820012345", "+919820012345"],
    ["+1 (415) 555-0123", "+14155550123"],
    ["+44 20 7946 0958", "+442079460958"],
  ])("%s → %s", (raw, e164) => {
    expect(normalizePhone(raw)).toBe(e164);
  });

  it.each(["", "12345", "5820012345", "+0 123 456 789", "call me", "98200O12345", "+91 98200 12345 6789 0"])("rejects %j", (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });

  it("knows Indian landlines can't take SMS, mobiles can", () => {
    expect(smsCapable("+919820012345")).toBe(true);
    expect(smsCapable("+912224123456")).toBe(false);
    expect(smsCapable("+14155550123")).toBe(true);
    expect(smsCapable("9820012345")).toBe(false);
  });

  it("keeps WhatsApp group ids as addresses, only on WhatsApp", () => {
    expect(isWhatsAppGroup("120363041234567890@g.us")).toBe(true);
    expect(normalizeAddress("whatsapp", "120363041234567890@g.us")).toBe("120363041234567890@g.us");
    expect(normalizeAddress("sms", "120363041234567890@g.us")).toBeNull();
    expect(normalizeAddress("sms", "98200 12345")).toBe("+919820012345");
  });

  it("masks addresses for logs and the ledger", () => {
    expect(maskAddress("+919820012345")).toBe("+91••••••2345");
    expect(maskAddress("+14155550123")).toBe("+•••••••0123");
    expect(maskAddress("120363041234567890@g.us")).toBe("group…7890");
    expect(maskAddress("+919820012345")).not.toContain("98200");
  });
});

describe("bot keywords", () => {
  it.each([
    ["YES", "yes"],
    ["yes!", "yes"],
    ["1", "yes"],
    ["Haan", "yes"],
    ["हाँ", "yes"],
    ["हो", "yes"],
    ["NO", "no"],
    ["2", "no"],
    ["nahi", "no"],
    ["नाही", "no"],
    ["STOP", "stop"],
    ["Unsubscribe", "stop"],
    ["  stop. ", "stop"],
    ["START", "start"],
    ["JOIN", "join"],
    ["i want to donate", "join"],
    ["HELP", "help"],
    ["hi", "help"],
  ])("%j → %s", (text, kw) => {
    expect(keyword(text)).toBe(kw);
  });

  it("only matches whole messages, so a sentence containing 'no' is not a decline", () => {
    expect(keyword("no O- available at KEM, need 2 units")).toBeNull();
    expect(keyword("yes we need blood near Sion")).toBeNull();
  });
});

describe("need parser", () => {
  it("reads the canonical English request", () => {
    const d = parseNeed("need 2 O- platelets near Sion urgent", PLACES);
    expect(d).toMatchObject({ bloodGroup: "O-", component: "platelets", units: 2, urgency: "urgent" });
    expect(d.place?.id).toBe("sion");
  });

  it("reads Hinglish", () => {
    const d = parseNeed("Sion mein 2 O negative platelets chahiye", PLACES);
    expect(d).toMatchObject({ bloodGroup: "O-", component: "platelets", units: 2 });
    expect(d.place?.name).toBe("Sion");
    expect(looksLikeNeed("Sion mein 2 O negative platelets chahiye")).toBe(true);
  });

  it.each([
    ["B+ve blood required", "B+"],
    ["AB pos plasma", "AB+"],
    ["ab negative", "AB-"],
    ["A − 3 units", "A-"],
    ["o-negative donor needed", "O-"],
    ["O+", "O+"],
  ])("blood group in %j → %s", (text, group) => {
    expect(parseBloodGroup(text)).toBe(group);
  });

  it("never guesses Rh: bare letters are not a group", () => {
    expect(parseBloodGroup("need a donor for o group")).toBeNull();
    expect(parseBloodGroup("need blood at Dadar")).toBeNull();
    expect(parseBloodGroup("about 5 units")).toBeNull();
  });

  it("maps component vocabulary", () => {
    expect(parseComponent("2 SDP needed")).toBe("platelets");
    expect(parseComponent("FFP 4 units")).toBe("plasma");
    expect(parseComponent("PRBC B+")).toBe("red_cells");
    expect(parseComponent("whole blood O+")).toBe("whole_blood");
    expect(parseComponent("need O+ blood")).toBeNull();
  });

  it("reads units and caps them", () => {
    expect(parseUnits("3 bags of B+")).toBe(3);
    expect(parseUnits("need 2 O- platelets")).toBe(2);
    expect(parseUnits("two units AB+")).toBe(2);
    expect(parseUnits("99 units")).toBe(20);
    expect(parseUnits("O- platelets near Sion")).toBeNull();
  });

  it("reads urgency", () => {
    expect(parseUrgency("emergency! O- needed")).toBe("critical");
    expect(parseUrgency("turant chahiye")).toBe("critical");
    expect(parseUrgency("urgent B+")).toBe("urgent");
    expect(parseUrgency("B+ for surgery tomorrow")).toBe("routine");
    expect(parseUrgency("B+ near Dadar")).toBeNull();
  });

  it("matches places by whole words, longest name first, hospitals over areas", () => {
    expect(matchPlace("patient at Nair Hospital", PLACES)?.id).toBe("hsp-nair-mumbai-central");
    expect(matchPlace("admitted in sion hospital", PLACES)?.id).toBe("hsp-sion-ltmgh");
    expect(matchPlace("near Mumbai Central station", PLACES)?.id).toBe("mumbai-central");
    expect(matchPlace("near sionx", PLACES)).toBeNull();
    expect(matchPlace("sion", PLACES, ["area"])?.id).toBe("sion");
  });

  it("does not treat chit-chat as a need", () => {
    expect(looksLikeNeed("thanks, see you tomorrow")).toBe(false);
    expect(looksLikeNeed("need O+ near Dadar")).toBe(true);
    expect(looksLikeNeed("खून चाहिए")).toBe(true);
  });
});

describe("Workers AI merge (safety rules)", () => {
  const ai = { isBloodRequest: true, bloodGroup: "B+" as const, component: "plasma" as const, units: 4, place: "Dadar", urgency: "critical" as const };

  it("parses model JSON wrapped in prose or fences, rejects garbage", () => {
    expect(parseModelJson('Sure! ```json\n{"isBloodRequest":true,"bloodGroup":"O-","component":null,"units":2,"place":"Sion","urgency":null}\n```')).toMatchObject({
      bloodGroup: "O-",
      units: 2,
    });
    expect(parseModelJson("no json here")).toBeNull();
    expect(parseModelJson('{"isBloodRequest":"maybe"}')).toBeNull();
    // Invalid enum values degrade to null instead of failing the whole object.
    expect(parseModelJson('{"isBloodRequest":true,"bloodGroup":"O","component":"blood","units":0,"place":null,"urgency":"now"}')).toMatchObject({
      bloodGroup: null,
      component: null,
      units: null,
    });
  });

  it("the parser wins wherever it found something", () => {
    const text = "need 2 O- near Sion";
    const r = mergeNeed(text, parseNeed(text, PLACES), ai, PLACES);
    expect(r.draft).toMatchObject({ bloodGroup: "O-", units: 2, urgency: "critical" });
    // Latin script: the model may not invent a component either; the bot assumes red cells and says so.
    expect(r.draft.component).toBeNull();
    expect(r.draft.place?.id).toBe("sion");
  });

  it("never accepts a model-invented blood group for Latin-script text", () => {
    const text = "need blood near Dadar asap";
    const r = mergeNeed(text, parseNeed(text, PLACES), ai, PLACES);
    expect(r.draft.bloodGroup).toBeNull();
    expect(r.draft.place?.id).toBe("dadar");
  });

  it("accepts the model's group for Devanagari text the regex can't read", () => {
    const text = "दादर में बी पॉजिटिव खून चाहिए";
    const r = mergeNeed(text, parseNeed(text, PLACES), ai, PLACES);
    expect(r.draft.bloodGroup).toBe("B+");
    expect(r.draft.component).toBe("plasma");
  });

  it("drops a model place that isn't in the real gazetteer", () => {
    const text = "need O+ urgently";
    const r = mergeNeed(text, parseNeed(text, PLACES), { ...ai, place: "Atlantis General" }, PLACES);
    expect(r.draft.place).toBeNull();
  });

  it("falls back to the parser alone when the model fails", () => {
    const text = "Sion mein 2 O negative platelets chahiye";
    const r = mergeNeed(text, parseNeed(text, PLACES), null, PLACES);
    expect(r.source).toBe("parser");
    expect(r.isNeed).toBe(true);
    expect(r.draft.bloodGroup).toBe("O-");
  });
});

describe("language and copy", () => {
  it("parses the JOIN language answer", () => {
    expect(parseLanguageChoice("1")).toBe("en");
    expect(parseLanguageChoice("hindi")).toBe("hi");
    expect(parseLanguageChoice("मराठी")).toBe("mr");
    expect(parseLanguageChoice("4")).toBeNull();
  });

  it("detects reply language from script", () => {
    expect(detectLanguage("need O+ near Sion")).toBe("en");
    expect(detectLanguage("खून चाहिए")).toBe("hi");
    expect(detectLanguage("मला रक्त हवे आहे")).toBe("mr");
  });

  it("strips WhatsApp markup for SMS only", () => {
    const body = "*Go to:* KEM\n_need 2 O- platelets near Sion_";
    expect(formatForChannel(body, "whatsapp")).toBe(body);
    expect(formatForChannel(body, "sms")).toBe("Go to: KEM\nneed 2 O- platelets near Sion");
  });

  it("every alert carries YES / NO / STOP instructions in each language", () => {
    for (const l of ["en", "hi", "mr"] as const) {
      const s = say("alertSuffix", l);
      expect(s).toContain("YES");
      expect(s).toContain("NO");
      expect(s).toContain("STOP");
    }
  });

  it("labels data freshness", () => {
    expect(freshnessLabel(25)).toBe("updated 25 min ago");
    expect(freshnessLabel(660)).toBe("updated 11h ago");
    expect(freshnessLabel(4 * 1440)).toBe("updated 4 days ago");
  });
});
