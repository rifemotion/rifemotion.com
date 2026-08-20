import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb, saveDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function generateStudioMessagesDataset() {
  const now = Date.now();
  const msInHour = 3600 * 1000;
  const list = [];

  const accounts = [
    {
      name: 'Work (Aescripts)',
      email: 'rifemotion.info@gmail.com',
      platform: 'gmail',
      templates: [
        { sender: 'Lloyd Alvarez (Aescripts)', email: 'lloyd@aescripts.com', title: 'Timing adjustment for Scene #4', body: 'Hey Mykyta! Client requested a 2-second timing adjustment for Scene #4 before final 4K render. Please review the updated curve and send preview.', urgency: 'red' },
        { sender: 'Aescripts Sales', email: 'sales@aescripts.com', title: 'LaPath v1.2 Sale Notification ($49.00)', body: 'You have a new commercial license purchase for LaPath AE Script. Payout will be processed on the 1st.', urgency: 'green' },
        { sender: 'Aescripts Support', email: 'support@aescripts.com', title: 'User Ticket: AE 2025 CEP Scaling', body: 'Customer inquiry regarding LaPath panel scaling on macOS Sonoma. Please check debug logs.', urgency: 'yellow' },
        { sender: 'Motion Science', email: 'cameron@motionscience.tv', title: 'Tutorial Collaboration Request', body: 'Hey Mykyta, would you be interested in featuring LaPath in our next After Effects masterclass?', urgency: 'yellow' },
        { sender: 'Gumroad Payouts', email: 'noreply@gumroad.com', title: 'Weekly Studio Payout Processed', body: 'Your weekly balance for preset packs and scripts has been transferred to Santander Bank.', urgency: 'grey' },
        { sender: 'Aescripts QA', email: 'qa@aescripts.com', title: 'CEP Extension Sandbox Testing Passed', body: 'Automated test suite for the latest build passed with 0 memory leaks. Ready for staging.', urgency: 'green' },
        { sender: 'Adobe Exchange', email: 'exchange@adobe.com', title: 'Extension Monthly Metrics Report', body: 'LaPath reached 4,200 active weekly instances across AE CC 2023-2025 users worldwide.', urgency: 'grey' },
        { sender: 'School of Motion', email: 'partners@schoolofmotion.com', title: 'Podcast Guest Invitation', body: 'We would love to have you on the Podcast to discuss custom tooling and scripting in After Effects.', urgency: 'yellow' },
        { sender: 'Aescripts Community', email: 'forum@aescripts.com', title: 'New Thread: Spline Curvature Request', body: 'A user posted a feature request for automatic Bezier tangent balancing in the forums.', urgency: 'grey' },
        { sender: 'Motion Design School', email: 'hello@motiondesign.school', title: 'Expressions Course Proposal Review', body: 'We reviewed the outline for your Advanced After Effects Expressions course. Let us schedule a call.', urgency: 'red' }
      ]
    },
    {
      name: 'Motion Studio',
      email: 'rifemotion.com@gmail.com',
      platform: 'gmail',
      templates: [
        { sender: 'Vertex Motion Agency', email: 'contact@vertex-motion.com', title: 'Commercial Offer (Nike 30s Kinetic)', body: 'Hi Mykyta! We would love to hire you as lead motion designer for our upcoming Nike 30s commercial.', urgency: 'red' },
        { sender: 'Tokyo AI Robotics', email: 'kenji@robotics.tokyo', title: 'Visual Identity Keynote Reveal', body: 'Inquiry regarding 3D motion identity for our next hardware keynote reveal in Shibuya.', urgency: 'red' },
        { sender: 'Apple Music Creative', email: 'motion-inbound@apple.com', title: 'Artist Album Canvas NDA & Brief', body: 'Please review the attached NDA for upcoming animated album artwork on Apple Music.', urgency: 'red' },
        { sender: 'Buck Studio NY', email: 'talent@buck.co', title: 'Freelance Roster Availability Q3/Q4', body: 'Hey Mykyta, checking in on your freelance availability for remote motion design contracts.', urgency: 'yellow' },
        { sender: 'Oddfellows', email: 'producers@oddfellows.tv', title: 'Brand Anthem Kinetic Sequences', body: 'We have a 4-week sprint starting next month and need your character easing & typography skills.', urgency: 'yellow' },
        { sender: 'Strikers Studio', email: 'inbox@strikers.studio', title: 'Showreel Feedback & Collab', body: 'Huge fan of your latest easing breakdown reel. Would love to partner on upcoming client 3D teasers.', urgency: 'grey' },
        { sender: 'Giant Ant', email: 'jobs@giantant.ca', title: 'Guest Artist Spotlight', body: 'We are curating an internal design talk on scripting workflows and would love you to share tips.', urgency: 'grey' },
        { sender: 'Tendril Design', email: 'hello@tendril.ca', title: 'Houdini / Cinema 4D Motion Inquiry', body: 'Checking your availability for procedural animation and complex typography sequences.', urgency: 'yellow' },
        { sender: 'Hyperquake', email: 'studio@hyperquake.com', title: 'Brand Launch Identity System', body: 'Client approved the moodboard. We are ready to move forward with the animation contract.', urgency: 'red' },
        { sender: 'ManvsMachine', email: 'talent@manvsmachine.co.uk', title: 'Freelance Motion Designer Inquiry', body: 'Hey! Loved your recent portfolio updates. Are you open for a 2-week commercial booking?', urgency: 'yellow' }
      ]
    },
    {
      name: 'Personal 1',
      email: 'nikitasolodkij3@gmail.com',
      platform: 'gmail',
      templates: [
        { sender: 'Google Cloud Billing', email: 'cloud-billing@google.com', title: 'Gemini Flash API Invoice Settled', body: 'Your monthly Google Cloud Platform charges have been automatically settled.', urgency: 'green' },
        { sender: 'GitHub Notifications', email: 'notifications@github.com', title: 'Security Alert: Dependency Upgrade', body: 'Dependabot submitted a PR to bump next to 14.2.35 in rifemotion.com repository.', urgency: 'grey' },
        { sender: 'Vercel Deployment', email: 'notifications@vercel.com', title: 'Deployment Succeeded: rifemotion.com', body: 'Production build main successfully deployed to edge network in 420ms.', urgency: 'green' },
        { sender: 'Namecheap Support', email: 'support@namecheap.com', title: 'Domain Auto-Renewal: rifemotion.com', body: 'Your domain name rifemotion.com is scheduled for auto-renewal next year. No action needed.', urgency: 'grey' },
        { sender: 'Cloudflare Worker', email: 'alerts@cloudflare.com', title: 'Worker KV Latency & Quota Nominal', body: 'Your KV database handled 18,400 read requests this month with 0 throttles.', urgency: 'grey' },
        { sender: 'Spotify Premium', email: 'no-reply@spotify.com', title: 'Monthly Family Subscription Receipt', body: 'Thank you for your payment. Your receipt for Spotify Premium has been processed.', urgency: 'grey' },
        { sender: 'Steam Games', email: 'noreply@steampowered.com', title: 'Wishlist Item On Sale', body: 'An item on your Steam wishlist is currently 50% off during the summer sale.', urgency: 'grey' },
        { sender: 'Airbnb Support', email: 'automated@airbnb.com', title: 'Booking Confirmation for Warsaw Stay', body: 'Your reservation details and host check-in instructions are ready for review.', urgency: 'yellow' },
        { sender: 'Uber Receipts', email: 'uber.poland@uber.com', title: 'Your Trip Receipt: Central Station', body: 'Thanks for riding with Uber. Total: 28.50 PLN. Download tax invoice in PDF.', urgency: 'grey' },
        { sender: 'Allegro Smart', email: 'powiadomienia@allegro.pl', title: 'Paczka została nadana w Paczkomacie', body: 'Twoja przesyłka z kablem DisplayPort 2.1 wyruszyła w drogę do Paczkomatu.', urgency: 'green' }
      ]
    },
    {
      name: 'Personal 2',
      email: 'nekitsolodkij@gmail.com',
      platform: 'gmail',
      templates: [
        { sender: 'Adobe Creative Cloud', email: 'exchange-support@adobe.com', title: 'LaPath 1.2.0 Approved on Exchange', body: 'Your update passed automated validation and is live worldwide on Adobe Exchange.', urgency: 'green' },
        { sender: 'Maxon Redshift', email: 'licensing@maxon.net', title: 'Cinema 4D + Redshift License Active', body: 'Your annual subscription has been renewed. High-performance GPU rendering enabled.', urgency: 'grey' },
        { sender: 'Autodesk Maya', email: 'accounts@autodesk.com', title: 'Student License Verification', body: 'Your educational license status with PJATK university has been verified for 12 months.', urgency: 'green' },
        { sender: 'SideFX Houdini', email: 'support@sidefx.com', title: 'Houdini Indie 20.5 Build Available', body: 'Download the latest production build featuring enhanced Solaris Karma render delegates.', urgency: 'grey' },
        { sender: 'Discord Notifications', email: 'noreply@discord.com', title: 'Motion Designers Guild Digest', body: 'Catch up on top trending expressions and kinetic typography breakdowns this week.', urgency: 'grey' },
        { sender: 'Telegram Web', email: 'login@telegram.org', title: 'New Web Session Authorized', body: 'Your account @rifemotion authorized a new session from Warsaw, Poland (Edge Browser).', urgency: 'grey' },
        { sender: 'Epic Games Unreal', email: 'unreal@epicgames.com', title: 'Unreal Engine 5.4 Motion Design Kit', body: 'Check out the new Avalanche 2D/3D broadcast motion graphics toolset in Unreal Engine 5.4.', urgency: 'yellow' },
        { sender: 'ArtStation Trends', email: 'digest@artstation.com', title: 'Staff Pick: Kinetic Typography', body: 'Your recent project was featured in the curated 3D Motion Graphics channel.', urgency: 'green' },
        { sender: 'Behance Portfolio', email: 'notifications@behance.net', title: 'Your Project received 450 Appreciations', body: 'LaPath Branding & Tool Identity is trending on Behance Interaction Design feed.', urgency: 'green' },
        { sender: 'Patreon Creators', email: 'creator@patreon.com', title: 'Monthly Motion Pack Download Stats', body: '128 patrons downloaded your After Effects easing curve master templates.', urgency: 'grey' }
      ]
    },
    {
      name: 'Banking & Finance',
      email: 'nekitbanking@gmail.com',
      platform: 'gmail',
      templates: [
        { sender: 'Santander Bank Polska', email: 'powiadomienia@santander.pl', title: 'Miesięczny wyciąg firmowy i VAT', body: 'Zestawienie operacji bankowych oraz wyciąg VAT za ubiegły okres są gotowe w Santander24.', urgency: 'grey' },
        { sender: 'mBank Biznes', email: 'kontakt@mbank.pl', title: 'Potwierdzenie przelewu SWIFT USD', body: 'Otrzymano płatność przychodzącą w walucie USD od Aescripts & Aeplugins LLC.', urgency: 'green' },
        { sender: 'Urząd Skarbowy', email: 'e-urzad@mf.gov.pl', title: 'Potwierdzenie UPO: Deklaracja PIT/VAT', body: 'Urzędowe Poświadczenie Odbioru dla złożonej deklaracji podatkowej zostało wygenerowane.', urgency: 'green' },
        { sender: 'Revolut Business', email: 'business@revolut.com', title: 'Wymiana walutowa EUR/PLN zrealizowana', body: 'Zlecenie automatycznej wymiany po kursie 4.28 PLN zostało pomyślnie zrealizowane.', urgency: 'grey' },
        { sender: 'Santander24 Alert', email: 'security@santander.pl', title: 'Logowanie do bankowości elektronicznej', body: 'Zarejestrowano pomyślne logowanie do serwisu Santander24 z adresu IP w Warszawie.', urgency: 'grey' },
        { sender: 'Księgowość infakt.pl', email: 'faktury@infakt.pl', title: 'Faktura sprzedaży #FV/2026/08/14', body: 'Klient opłacił fakturę za usługi projektowania animacji 3D. Status: Opłacona.', urgency: 'green' },
        { sender: 'ZUS PUE', email: 'pue-powiadomienia@zus.pl', title: 'Nowy dokument w skrzynce PUE ZUS', body: 'Informacja o stanie konta ubezpieczonego oraz rozliczeniu składek za bieżący miesiąc.', urgency: 'grey' },
        { sender: 'PayPal Merchant', email: 'service@paypal.com', title: 'Otrzymano płatność za licencję CEP', body: 'Użytkownik przelał środki za komercyjną licencję wtyczki After Effects.', urgency: 'green' },
        { sender: 'Stripe Payments', email: 'receipts@stripe.com', title: 'Daily Payout Scheduled: 3,450 PLN', body: 'Your automated daily payout is on its way to Santander Bank ending in 4102.', urgency: 'green' },
        { sender: 'Mastercard Secure', email: 'alerts@mastercard.com', title: 'Płatność zbliżeniowa kartą firmową', body: 'Autoryzowano płatność kartą w kwocie 149.00 PLN za subskrypcję oprogramowania.', urgency: 'grey' }
      ]
    },
    {
      name: 'PJATK University',
      email: 's37167@pjwstk.edu.pl',
      platform: 'gmail',
      templates: [
        { sender: 'PJATK Dziekanat', email: 'dziekanat@pjwstk.edu.pl', title: 'Wyniki egzaminu z Analizy i Grafiki 3D', body: 'Cześć Mykyta! Oceny z egzaminu oraz projektu końcowego z Grafiki zostały wpisane do systemu Edukacja.', urgency: 'yellow' },
        { sender: 'Prof. dr hab. Kowalski', email: 'jkowalski@pjwstk.edu.pl', title: 'Konsultacje w sprawie pracy dyplomowej', body: 'Proszę o przesłanie zaktualizowanego konspektu animacji 3D oraz bibliografii do piątku.', urgency: 'red' },
        { sender: 'Biblioteka Główna PJATK', email: 'biblioteka@pjwstk.edu.pl', title: 'Dostęp do bazy IEEE Xplore & ACM', body: 'Twoje konto studenckie ma aktywny pełny dostęp do publikacji naukowych z grafiki komputerowej.', urgency: 'grey' },
        { sender: 'Samorząd Studentów PJATK', email: 'samorzad@pjwstk.edu.pl', title: 'Warsztaty: Zaawansowany Rendering GPU', body: 'Zapraszamy na bezpłatne warsztaty laboratoryjne z optymalizacji shaderów i oświetlenia.', urgency: 'grey' },
        { sender: 'Biuro Karier PJATK', email: 'biurokarier@pjwstk.edu.pl', title: 'Oferta stażu: Lead 3D Generalist', body: 'Studio gier poszukuje studenta 3/4 roku do zespołu animacji cinematics.', urgency: 'yellow' },
        { sender: 'System Edukacja PJATK', email: 'edukacja-noreply@pjwstk.edu.pl', title: 'Plan zajęć na semestr zimowy 2026', body: 'Wstępny harmonogram zajęć laboratoryjnych i wykładów został opublikowany w portalu.', urgency: 'grey' },
        { sender: 'Laboratorium VR/AR', email: 'vr-lab@pjwstk.edu.pl', title: 'Rezerwacja stanowiska Motion Capture', body: 'Twoja rezerwacja studia MoCap na środę w godzinach 14:00 - 18:00 została potwierdzona.', urgency: 'green' },
        { sender: 'Dział Stypendiów PJATK', email: 'stypendia@pjwstk.edu.pl', title: 'Decyzja w sprawie stypendium rektora', body: 'Decyzja o przyznaniu stypendium za osiągnięcia artystyczne i naukowe jest gotowa do odbioru.', urgency: 'green' },
        { sender: 'Koło Naukowe ShaderLab', email: 'shaderlab@pjwstk.edu.pl', title: 'Hackathon Grafiki Czasu Rzeczywistego', body: 'Dołącz do zespołu projektowego na 48-godzinny maraton tworzenia interaktywnych instalacji wizualnych.', urgency: 'yellow' },
        { sender: 'Kwestura PJATK', email: 'kwestura@pjwstk.edu.pl', title: 'Potwierdzenie rozliczenia czesnego', body: 'Wpłata za czesne została pomyślnie zaksięgowana na Twoim indywidualnym subkoncie studenta.', urgency: 'grey' }
      ]
    }
  ];

  // Social platforms
  const socialTemplates = [
    { platform: 'telegram', account: '@rifemotion', email: '@rifemotion', sender: 'Motion Designer Community', senderEmail: '@motion_chat', title: 'Lottie Corner Curvature Export', body: 'Does the new LaPath smoothing engine support spline interpolation before exporting directly to web Lottie JSON?', urgency: 'green' },
    { platform: 'youtube', account: 'rifemotion Studio', email: 'youtube/rifemotion', sender: 'AnimFan2026', senderEmail: 'AnimFan2026', title: 'Keyframing Curves Masterclass Comment', body: 'This is the cleanest easing tutorial! Which plugin do you use for handle interpolation?', urgency: 'yellow' },
    { platform: 'instagram', account: '@rifemotion', email: '@rifemotion', sender: 'Studio Nomad (Tokyo)', senderEmail: '@studio_nomad_jp', title: 'Tokyo Brand Rebranding Pitch', body: 'Loved your recent After Effects easing reels. We would like to invite you to animate the new visual identity for a Tokyo AI startup.', urgency: 'red' },
    { platform: 'reddit', account: 'u/rifemotion', email: 'r/AfterEffects', sender: 'u/ae_script_enthusiast', senderEmail: 'u/ae_script_enthusiast', title: 'LaPath CEP Dockable Panel Feedback', body: 'Hey! Tested your CEP panel on After Effects 2025 on Windows 11. Zero crashes, incredibly fast Bezier solver!', urgency: 'green' },
    { platform: 'discord', account: 'rifemotion#0001', email: 'Motion Guild Discord', sender: 'Motion Guild Admin', senderEmail: 'GuildAdmin', title: 'Featured Script of the Month Announcement', body: 'Your script LaPath has been voted tool of the month in the server showcase channel!', urgency: 'green' },
    { platform: 'twitter', account: '@rifemotion', email: '@rifemotion', sender: 'Motion Weekly', senderEmail: '@motionweekly', title: 'Retweet & Feature Mention', body: 'Your 3D kinetic typography breakdown is going viral on motion Twitter today!', urgency: 'yellow' },
    { platform: 'behance', account: 'Mykyta Solodkyi', email: 'behance/rifemotion', sender: 'Behance Curators', senderEmail: 'curators@behance.net', title: 'Interaction Design Featured Project', body: 'Congratulations! Your portfolio project was featured in the curated Behance Interactive feed.', urgency: 'green' },
    { platform: 'threads', account: '@rifemotion', email: '@rifemotion', sender: 'Motion Creator Circle', senderEmail: '@creator_circle', title: 'Collab on Next Preset Pack', body: 'Hey Mykyta! Would love to partner on creating modular kinetic presets.', urgency: 'grey' }
  ];

  // 1. Generate 20 items per Gmail account (120 total)
  accounts.forEach(acc => {
    for (let i = 0; i < 20; i++) {
      const tmpl = acc.templates[i % acc.templates.length];
      const hourOffset = (i * 2.5) + (Math.random() * 1.5);
      const isRead = i > 3; // First 3-4 unread
      list.push({
        id: `msg_${acc.email.replace(/[^a-zA-Z0-9]/g, '_')}_${i+1}`,
        platform: 'gmail',
        account: acc.name,
        accountEmail: acc.email,
        sender: tmpl.sender,
        senderEmail: tmpl.email,
        shortTitle: tmpl.title,
        subject: tmpl.title,
        body: tmpl.body,
        urgency: tmpl.urgency,
        read: isRead,
        date: new Date(now - hourOffset * msInHour).toISOString(),
        url: 'https://mail.google.com'
      });
    }
  });

  // 2. Generate 10 items per Social platform
  socialTemplates.forEach((st, idx) => {
    for (let i = 0; i < 10; i++) {
      const hourOffset = (i * 4) + (idx * 2) + 1;
      const isRead = i > 2;
      list.push({
        id: `msg_${st.platform}_${i+1}`,
        platform: st.platform,
        account: st.account,
        accountEmail: st.email,
        sender: st.sender,
        senderEmail: st.senderEmail,
        shortTitle: st.title,
        subject: st.title,
        body: st.body,
        urgency: st.urgency,
        read: isRead,
        date: new Date(now - hourOffset * msInHour).toISOString(),
        url: st.platform === 'telegram' ? 'https://t.me' : (st.platform === 'youtube' ? 'https://youtube.com' : 'https://instagram.com')
      });
    }
  });

  list.sort((a, b) => new Date(b.date) - new Date(a.date));
  return list;
}

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    let messages = db.messages || [];

    if (!messages || messages.length === 0) {
      messages = generateStudioMessagesDataset();
      db.messages = messages;
      await saveDb(db);
    }

    return NextResponse.json({ ok: true, messages });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    const messages = generateStudioMessagesDataset();
    db.messages = messages;
    await saveDb(db);

    return NextResponse.json({ ok: true, messages, syncedCount: messages.length });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
