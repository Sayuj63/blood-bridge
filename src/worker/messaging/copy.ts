/**
 * Bot copy. Short, plain, no clinical advice. Hindi and Marathi where it's cheap
 * (menus, prompts, confirmations); bank listings stay in English because names,
 * phone numbers and addresses are English in the source directory anyway.
 * `*bold*` is WhatsApp markup; formatForChannel() strips it for SMS.
 */
import type { Language, MessageChannel } from "../../shared/domain";

type Copy = Record<Language, string>;

const t = (copy: Copy, language: Language, vars: Record<string, string | number> = {}): string =>
  Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), copy[language] ?? copy.en);

export const COPY = {
  help: {
    en: "*Blood Bridge*: Mumbai blood stock and donors.\n• Need blood? Send the group, component and area, e.g. _need 2 O- platelets near Sion_\n• JOIN: become a donor\n• YES / NO: answer a donation alert\n• STOP: stop all messages\nStock info only, not medical advice.",
    hi: "*Blood Bridge*: मुंबई में ब्लड स्टॉक और डोनर।\n• खून चाहिए? ग्रुप, कंपोनेंट और इलाका भेजें, जैसे _Sion mein 2 O negative platelets chahiye_\n• JOIN: डोनर बनें\n• YES / NO: डोनेशन अलर्ट का जवाब\n• STOP: सभी मैसेज बंद\nसिर्फ़ स्टॉक जानकारी, चिकित्सा सलाह नहीं।",
    mr: "*Blood Bridge*: मुंबईतील रक्तसाठा आणि रक्तदाते.\n• रक्त हवे? ग्रुप, घटक आणि परिसर पाठवा, उदा. _need 2 O- platelets near Sion_\n• JOIN: रक्तदाता व्हा\n• YES / NO: अलर्टला उत्तर द्या\n• STOP: सर्व मेसेज बंद\nफक्त साठ्याची माहिती, वैद्यकीय सल्ला नाही.",
  },
  stopped: {
    en: "You're unsubscribed. Blood Bridge won't message this number again. Reply START to resume.",
    hi: "आपकी सदस्यता समाप्त हो गई है। Blood Bridge इस नंबर पर दोबारा मैसेज नहीं करेगा। फिर से शुरू करने के लिए START भेजें।",
    mr: "तुमची सदस्यता बंद झाली आहे. Blood Bridge या नंबरवर पुन्हा मेसेज करणार नाही. पुन्हा सुरू करण्यासाठी START पाठवा.",
  },
  startNoDonor: {
    en: "Messages are back on. Send JOIN to register as a donor, or HELP for the menu.",
    hi: "मैसेज फिर से चालू हैं। डोनर बनने के लिए JOIN भेजें, या मेनू के लिए HELP।",
    mr: "मेसेज पुन्हा सुरू आहेत. रक्तदाता होण्यासाठी JOIN पाठवा, किंवा मेनूसाठी HELP.",
  },
  joinGroup: {
    en: "Thanks for stepping up! What is your blood group? (e.g. O+, B-, AB+)\nNot sure? Reply HELP, and check at your next donation.",
    hi: "धन्यवाद! आपका ब्लड ग्रुप क्या है? (जैसे O+, B-, AB+)",
    mr: "धन्यवाद! तुमचा रक्तगट कोणता? (उदा. O+, B-, AB+)",
  },
  joinGroupRetry: {
    en: "Please send your blood group with + or -, e.g. O+ or B-.",
    hi: "कृपया ब्लड ग्रुप + या - के साथ भेजें, जैसे O+ या B-।",
    mr: "कृपया रक्तगट + किंवा - सह पाठवा, उदा. O+ किंवा B-.",
  },
  joinArea: {
    en: "Got it: {group}. Which area do you live in? (e.g. Sion, Dadar, Andheri)\nWe store only the neighbourhood, never your address.",
    hi: "ठीक है: {group}. आप किस इलाके में रहते हैं? (जैसे Sion, Dadar, Andheri)",
    mr: "ठीक आहे: {group}. तुम्ही कोणत्या परिसरात राहता? (उदा. Sion, Dadar, Andheri)",
  },
  joinAreaRetry: {
    en: "I couldn't find that area. Try a nearby locality, e.g. {examples}.",
    hi: "यह इलाका नहीं मिला। पास का कोई इलाका लिखें, जैसे {examples}.",
    mr: "हा परिसर सापडला नाही. जवळचा परिसर लिहा, उदा. {examples}.",
  },
  joinLanguage: {
    en: "{area}, noted. Which language should alerts use?\n1. English\n2. हिन्दी\n3. मराठी",
    hi: "{area}, नोट किया। अलर्ट किस भाषा में चाहिए?\n1. English\n2. हिन्दी\n3. मराठी",
    mr: "{area}, नोंद केली. अलर्ट कोणत्या भाषेत हवे?\n1. English\n2. हिन्दी\n3. मराठी",
  },
  joinConsent: {
    en: "Last step: consent.\nBlood Bridge may message you here when a blood bank near {area} needs {group} donors (at most 2 a week, never at night if you ask). Banks see your number only after you reply YES to an alert.\nReply *YES* to agree, or *NO* to cancel. STOP works any time.",
    hi: "आख़िरी कदम: सहमति।\nजब {area} के पास किसी ब्लड बैंक को {group} डोनर चाहिए, Blood Bridge आपको यहाँ मैसेज कर सकता है (हफ़्ते में अधिकतम 2)। आपका नंबर बैंक को तभी दिखेगा जब आप अलर्ट पर YES कहेंगे।\nसहमति के लिए *YES*, रद्द करने के लिए *NO* भेजें। STOP कभी भी।",
    mr: "शेवटची पायरी: संमती.\n{area} जवळील रक्तपेढीला {group} रक्तदाते हवे असतील तेव्हा Blood Bridge तुम्हाला इथे मेसेज करू शकते (आठवड्यात जास्तीत जास्त 2). तुम्ही अलर्टला YES दिल्यावरच बँकेला तुमचा नंबर दिसेल.\nसंमतीसाठी *YES*, रद्द करण्यासाठी *NO* पाठवा. STOP कधीही.",
  },
  joinConsentRetry: {
    en: "Please reply YES to agree to donation alerts, or NO to cancel.",
    hi: "डोनेशन अलर्ट के लिए YES या रद्द करने के लिए NO भेजें।",
    mr: "अलर्टसाठी YES किंवा रद्द करण्यासाठी NO पाठवा.",
  },
  joinCancelled: {
    en: "No problem, nothing was saved. Send JOIN any time.",
    hi: "कोई बात नहीं, कुछ भी सेव नहीं हुआ। कभी भी JOIN भेजें।",
    mr: "हरकत नाही, काहीही सेव्ह झाले नाही. कधीही JOIN पाठवा.",
  },
  joined: {
    en: "You're registered as a donor near {area}, blood group *{group}*. Thank you!\nWhen a nearby bank needs you, we'll message here. Reply YES to go, NO to skip, STOP to unsubscribe.",
    hi: "आप {area} के पास *{group}* डोनर के रूप में रजिस्टर हैं। धन्यवाद!\nजब पास के बैंक को आपकी ज़रूरत होगी, हम यहाँ मैसेज करेंगे। जाने के लिए YES, छोड़ने के लिए NO, बंद करने के लिए STOP।",
    mr: "तुम्ही {area} जवळ *{group}* रक्तदाता म्हणून नोंदवले आहात. धन्यवाद!\nजवळच्या बँकेला गरज असेल तेव्हा आम्ही इथे मेसेज करू. जाण्यासाठी YES, वगळण्यासाठी NO, बंद करण्यासाठी STOP.",
  },
  resubscribed: {
    en: "Welcome back. Donation alerts are on again for this number. STOP works any time.",
    hi: "वापसी पर स्वागत है। इस नंबर पर डोनेशन अलर्ट फिर से चालू हैं। STOP कभी भी।",
    mr: "पुन्हा स्वागत आहे. या नंबरवर अलर्ट पुन्हा सुरू आहेत. STOP कधीही.",
  },
  alreadyRegistered: {
    en: "You're already registered as a donor (blood group {group}). Reply STOP to unsubscribe, or HELP for the menu.",
    hi: "आप पहले से {group} डोनर के रूप में रजिस्टर हैं। बंद करने के लिए STOP, मेनू के लिए HELP।",
    mr: "तुम्ही आधीच {group} रक्तदाता म्हणून नोंदवले आहात. बंद करण्यासाठी STOP, मेनूसाठी HELP.",
  },
  webWelcome: {
    en: "Blood Bridge: you're registered as a donor (blood group {group}) and asked for alerts on this number. We'll only message when a nearby bank needs you. Reply STOP to unsubscribe.",
    hi: "Blood Bridge: आप {group} डोनर के रूप में रजिस्टर हैं और इस नंबर पर अलर्ट चुने हैं। बंद करने के लिए STOP भेजें।",
    mr: "Blood Bridge: तुम्ही {group} रक्तदाता म्हणून नोंदवले आहात आणि या नंबरवर अलर्ट निवडले आहेत. बंद करण्यासाठी STOP पाठवा.",
  },
  alertSuffix: {
    en: "Reply YES if you can come, NO if not, STOP to opt out.",
    hi: "आ सकते हैं तो YES, नहीं तो NO, बंद करने के लिए STOP भेजें।",
    mr: "येऊ शकत असाल तर YES, नसेल तर NO, बंद करण्यासाठी STOP पाठवा.",
  },
  accepted: {
    en: "Thank you! You're confirmed.\n*Go to:* {bank}, {address}\n*Arrive:* {window}\n*Show this code at the desk:* {code}\nBank phone: {phone}\nIf you feel unwell, please don't come; just reply NO.",
    hi: "धन्यवाद! आपकी पुष्टि हो गई।\n*कहाँ:* {bank}, {address}\n*कब:* {window}\n*डेस्क पर यह कोड दिखाएँ:* {code}\nबैंक फ़ोन: {phone}\nतबीयत ठीक न हो तो न आएँ, बस NO भेजें।",
    mr: "धन्यवाद! तुमची खात्री झाली.\n*कुठे:* {bank}, {address}\n*कधी:* {window}\n*डेस्कवर हा कोड दाखवा:* {code}\nबँक फोन: {phone}\nबरे वाटत नसेल तर येऊ नका, फक्त NO पाठवा.",
  },
  declined: {
    en: "No problem, thank you for letting us know. We'll ask someone else.",
    hi: "कोई बात नहीं, बताने के लिए धन्यवाद। हम किसी और से पूछेंगे।",
    mr: "हरकत नाही, कळवल्याबद्दल धन्यवाद. आम्ही दुसऱ्या कोणाला विचारू.",
  },
  fulfilled: {
    en: "This need has already been met. Thank you for being ready to help!",
    hi: "यह ज़रूरत पूरी हो चुकी है। मदद के लिए तैयार रहने का धन्यवाद!",
    mr: "ही गरज आधीच पूर्ण झाली आहे. मदतीसाठी तयार असल्याबद्दल धन्यवाद!",
  },
  nothingPending: {
    en: "There's no open donation request for you right now. Thank you! We'll message when a nearby bank needs you.",
    hi: "अभी आपके लिए कोई खुला अनुरोध नहीं है। धन्यवाद! ज़रूरत होने पर हम मैसेज करेंगे।",
    mr: "सध्या तुमच्यासाठी कोणतीही विनंती नाही. धन्यवाद! गरज असेल तेव्हा आम्ही मेसेज करू.",
  },
  needGroup: {
    en: "Which blood group is needed? Send it with + or -, e.g. O+ or B-.",
    hi: "कौन सा ब्लड ग्रुप चाहिए? + या - के साथ भेजें, जैसे O+ या B-।",
    mr: "कोणता रक्तगट हवा आहे? + किंवा - सह पाठवा, उदा. O+ किंवा B-.",
  },
  needPlace: {
    en: "Which hospital or area is the patient in? (e.g. Sion, Nair Hospital, Ghatkopar)",
    hi: "मरीज़ किस अस्पताल या इलाके में है? (जैसे Sion, Nair Hospital, Ghatkopar)",
    mr: "रुग्ण कोणत्या रुग्णालयात किंवा परिसरात आहे? (उदा. Sion, Nair Hospital, Ghatkopar)",
  },
  groupNeedFormat: {
    en: "Blood Bridge can look this up. Send the group with + or - and an area, e.g. _need 2 O- platelets near Sion_.",
    hi: "Blood Bridge खोज सकता है। ग्रुप (+ या -) और इलाका भेजें, जैसे _Sion mein 2 O negative platelets chahiye_.",
    mr: "Blood Bridge शोधू शकते. ग्रुप (+ किंवा -) आणि परिसर पाठवा, उदा. _need 2 O- platelets near Sion_.",
  },
  rateLimited: {
    en: "You've sent a lot of messages. Please wait a little and try again, or call the blood bank directly.",
    hi: "बहुत सारे मैसेज आए हैं। थोड़ी देर बाद कोशिश करें, या सीधे ब्लड बैंक को कॉल करें।",
    mr: "खूप मेसेज आले आहेत. थोड्या वेळाने प्रयत्न करा, किंवा थेट रक्तपेढीला कॉल करा.",
  },
} satisfies Record<string, Copy>;

export type CopyKey = keyof typeof COPY;

export const say = (key: CopyKey, language: Language, vars?: Record<string, string | number>): string => t(COPY[key], language, vars);

/** WhatsApp renders *bold* and _italic_; SMS shows the asterisks, so strip them. */
export function formatForChannel(body: string, channel: MessageChannel): string {
  if (channel === "whatsapp") return body;
  return body.replace(/\*([^*\n]+)\*/g, "$1").replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,])/g, "$1$2");
}

/** "updated 11h ago" / "updated 25 min ago" from a freshness in minutes. */
export function freshnessLabel(minutes: number): string {
  if (minutes < 60) return `updated ${Math.max(1, Math.round(minutes))} min ago`;
  if (minutes < 48 * 60) return `updated ${Math.round(minutes / 60)}h ago`;
  return `updated ${Math.round(minutes / 1440)} days ago`;
}
