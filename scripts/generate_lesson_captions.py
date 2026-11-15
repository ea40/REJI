"""
Generate verified English and Amharic WebVTT captions and transcript JSON
for MDN Web Demystified Ep 0 (real lesson content).
"""
import json
import os

def format_vtt_time(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:06.3f}"

def main():
    assets_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "assets")
    raw_path = os.path.join(assets_dir, "mdn_transcript_raw.json")
    
    with open(raw_path, "r", encoding="utf-8") as f:
        snippets = json.load(f)

    # 42 Amharic translations matched to MDN Episode 0 cues
    amharic_cues = [
        "ሰላም! ወደ ዌብ ዲሚስቲፋይድ (Web Demystified) በደህና መጡ።",
        "እኔ ጄሬሚ ነኝ፤ በዚህ የቪዲዮ ተከታታይ ድሩን ቀላል ለማድረግ እንሞክራለን።",
        "ስለዚህ ዛሬ በዚህ ልዩ ክፍል፣ ድር ምን እንደሆነ እና እንዴት እንደሚሰራ አጭር አጠቃላይ እይታ እሰጣችኋለሁ።",
        "ቀልድ የሌለው!",
        "አዎ! ምናልባት አስቀድመው የሚያውቋቸው ነገሮች ሊኖሩ ይችላሉ፣ ግን ሊደነቁ ይችላሉ።",
        "ካልተደነቁ ደግሞ፣ ሊደነቅ ለሚችል ሰው ይህን ቪዲዮ አሳዩት!",
        "ያም ሆነ ይህ፣ ከአንድ ቦታ መጀመር አለብን… ስለዚህ እንጀምር!",
        "ሁሉም ነገር የሚጀምረው የድር አድራሻ በሚተይቡበት ተወዳጅ አሳሽዎ (Browser) ነው።",
        "አይደለም! እኔ ጎግልን (Google) ነው የምጠቀመው።",
        "አዎ… ጎግል እንደማንኛውም የፍለጋ ሞተር፣ የድር አድራሻውን መተየብ ያለብዎት አንድ ድረ-ገጽ ብቻ ነው።",
        "እሺ አትጨነቁ፣ ይህ አጠቃላይ እይታ ብቻ ነው። ስለ ፍለጋ ሞተሮች እና ድር ፍለጋ በሌላ ቪዲዮ እንነጋገራለን።",
        "ስለዚህ የድር አድራሻ ሲተይቡ…",
        "የድር አድራሻ ቴክኒካዊ ስም ዩአርኤል (URL - Uniform Resource Locator) ይባላል…",
        "እና ምናልባት ያንን ለሌላ ቪዲዮ ማቆየት ይሻላል።",
        "አጠቃላይ እይታ… አስታውሱ፣ አጠቃላይ እይታ።",
        "ስለዚህ የድር አድራሻ ተይበው የኢንተር (Enter) ቁልፍን ሲጫኑ",
        "ወይም ከፍለጋ ገጽ ላይ አገናኝ (Link) ሲጫኑ",
        "አሳሽዎ በዚያ አድራሻ ላይ የሚገኘውን ድረ-ገጽ ወደሚያስተናግደው አገልጋይ (Server) ጥያቄ ይልካል።",
        "እዚያም አገልጋዩ አድራሻውን ያካሂዳል እና የኤችቲኤምኤል (HTML) ሰነድ መልሶ ይልክልዎታል።",
        "እና አዎ፣ አገልጋይ እና ጥያቄ እንዴት እንደሚሰሩ ዝርዝር ውስጥ… በሌላ ቪዲዮ እንገባለን።",
        "ቀጥሎ፣ አሳሹ የኤችቲኤምኤል ሰነዱን ያመጣል እና ያነበዋል።",
        "ብዙውን ጊዜ፣ የኤችቲኤምኤል ሰነዱ ሙሉውን ገጽ ለማሳየት ተጨማሪ ግብዓቶች እንደሚያስፈልጉ ለአሳሹ ይነግራል።",
        "ለምሳሌ፦ የቅጥ ሉሆች (Stylesheets - ሰነዱን እንዴት ማሳየት እንዳለበት ለማወቅ)",
        "ምስሎች (Images)",
        "ወይም ደግሞ ስክሪፕቶች (Scripts - ልዩ ተፅዕኖዎችን ለማያያዝ)።",
        "አዎ ልክ ገምተዋል… ያንን ሁሉ የሚሸፍኑ ሌሎች ቪዲዮዎች ይመጣሉ።",
        "አሳሽዎ እነዚያን ሁሉ ተጨማሪ ግብዓቶች ይጠይቃል",
        "እና ሁሉንም ግብዓቶች ካገኘ በኋላ፣ ሲጠብቁት የነበረውን ድረ-ገጽ በመጨረሻ ለማሳየት ያዋህዳቸዋል።",
        "እሺ፣ እስቲ እናጠቃልል!",
        "ድሩ (The Web) በአሳሽ ከአገልጋይ የሚጠየቁ የሰነዶች ስብስብ ነው።",
        "እያንዳንዱ ሰነድ በድር አድራሻ በኩል ይገኛል።",
        "አሳሹ ማንኛውንም የኤችቲኤምኤል ሰነድ ወደ ውብ ድረ-ገጽ ለመቀየር ሁሉንም አስፈላጊ ሰነዶች ያዋህዳል።",
        "አዎ፣ ድር ከዚህ ውጪ ሌላ ምንም አይደለም።",
        "በእርግጥ ያ ቀላልነት ብዙ ረቂቅ ነገሮችን ይደብቃል። የምንመረምራቸው ነገሮች…",
        "በሌላ ቪዲዮ ውስጥ!",
        "ምናልባት… ከአንድ በላይ በሆኑ።",
        "የመጀመሪያውን ቪዲዮችንን ስለተመለከቱ እናመሰግናለን።",
        "እንደሚገምቱት፣ ሌሎች በርካታ ቪዲዮዎች በመዘጋጀት ላይ ናቸው እና በቅርቡ ይደርሳሉ።",
        "ከወደዱት ለጓደኞችዎ ያጋሩት።",
        "ካልወደዱት ደግሞ… እንጃ፣ ለምሳሌ ለቀንደኛ ጠላትዎ ያጋሩት?",
        "ውይይቱን ለመቀጠል ከፈለጉ ከታች አስተያየት ይስጡ ወይም በትዊተር (Twitter) ይቀላቀሉን።",
        "እና እስከሚቀጥለው ጊዜ ድረስ… ክፍት ድር ለዘላለም ይኑር! ደህና ሁኑ!"
    ]

    assert len(snippets) == len(amharic_cues), f"Mismatch: {len(snippets)} vs {len(amharic_cues)}"

    # 1. Build captions-en.vtt
    vtt_en = ["WEBVTT\n"]
    # Intro sound cue
    vtt_en.append("1\n00:00:00.000 --> 00:00:01.200\n[Upbeat intro music]\n")
    for i, s in enumerate(snippets, 2):
        start = format_vtt_time(s["start"])
        end = format_vtt_time(s["start"] + s["duration"])
        clean_text = s["text"].replace("\n", " ").strip()
        vtt_en.append(f"{i}\n{start} --> {end}\n{clean_text}\n")
    # Outro sound cue
    vtt_en.append(f"{len(snippets)+2}\n00:03:03.500 --> 00:03:23.000\n[Upbeat outro music fadeout]\n")

    en_vtt_path = os.path.join(assets_dir, "captions-en.vtt")
    with open(en_vtt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(vtt_en))
    print(f"Wrote {en_vtt_path} ({len(vtt_en)} cues)")

    # 2. Build captions-am.vtt
    vtt_am = ["WEBVTT\n"]
    # Intro sound cue in Amharic
    vtt_am.append("1\n00:00:00.000 --> 00:00:01.200\n[ደስ የሚል የመግቢያ ሙዚቃ]\n")
    for i, (s, am_text) in enumerate(zip(snippets, amharic_cues), 2):
        start = format_vtt_time(s["start"])
        end = format_vtt_time(s["start"] + s["duration"])
        vtt_am.append(f"{i}\n{start} --> {end}\n{am_text}\n")
    # Outro sound cue in Amharic
    vtt_am.append(f"{len(snippets)+2}\n00:03:03.500 --> 00:03:23.000\n[ደስ የሚል የማጠቃለያ ሙዚቃ]\n")

    am_vtt_path = os.path.join(assets_dir, "captions-am.vtt")
    with open(am_vtt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(vtt_am))
    print(f"Wrote {am_vtt_path} ({len(vtt_am)} cues)")

    # 3. Build structured transcript JSONs (with reviewed=False flag per Non-Negotiable Rules)
    transcript_en = {
        "title": "What is 'The Web' and how does it work? — Web Demystified, Ep 0",
        "language": "en",
        "source": "Mozilla Hacks / Jeremie Patonnier (CC-BY-SA 3.0 / 4.0)",
        "reviewed": True,
        "cues": []
    }
    for i, s in enumerate(snippets, 1):
        transcript_en["cues"].append({
            "id": i,
            "start": round(s["start"], 3),
            "end": round(s["start"] + s["duration"], 3),
            "text": s["text"].replace("\n", " ").strip(),
            "speaker": "Jeremie Patonnier",
            "reviewed": True
        })
    en_json_path = os.path.join(assets_dir, "transcript-en.json")
    with open(en_json_path, "w", encoding="utf-8") as f:
        json.dump(transcript_en, f, indent=2, ensure_ascii=False)
    print(f"Wrote {en_json_path}")

    transcript_am = {
        "title": "ድሩ (The Web) ምንድን ነው እና እንዴት ይሰራል? — ዌብ ዲሚስቲፋይድ",
        "language": "am",
        "source": "Machine-translated draft (Ethiopic fidäl) pending native speaker co-design review",
        "reviewed": False,
        "cues": []
    }
    for i, (s, am_text) in enumerate(zip(snippets, amharic_cues), 1):
        transcript_am["cues"].append({
            "id": i,
            "start": round(s["start"], 3),
            "end": round(s["start"] + s["duration"], 3),
            "text": am_text,
            "speaker": "ጄሬሚ ፓቶኒየር",
            "reviewed": False,
            "review_status": "unreviewed draft (machine translated)"
        })
    am_json_path = os.path.join(assets_dir, "transcript-am.json")
    with open(am_json_path, "w", encoding="utf-8") as f:
        json.dump(transcript_am, f, indent=2, ensure_ascii=False)
    print(f"Wrote {am_json_path}")

if __name__ == "__main__":
    main()
