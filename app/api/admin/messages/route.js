import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb, saveDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function generate20MessagesForAccount(accountName, accountEmail) {
  const now = Date.now();
  const msInHour = 3600 * 1000;
  const list = [];

  const templatesByAccount = {
    'rifemotion.info@gmail.com': [
      { sender: 'Aescripts Sales', senderEmail: 'sales@aescripts.com', title: 'LaPath v1.2 Sale Notification ($49.00)', body: 'You have a new direct purchase for LaPath AE Script. Payout will be processed on the 1st.', urgency: 'green' },
      { sender: 'Lloyd Alvarez', senderEmail: 'lloyd@aescripts.com', title: 'Frontpage Feature Banner Approval', body: 'Hey Mykyta! We reviewed your showcase video. It will be featured on the Aescripts homepage next week.', urgency: 'red' },
      { sender: 'Aescripts Support', senderEmail: 'support@aescripts.com', title: 'User Ticket: AE 2024 CEP Compatibility', body: 'Customer inquiry regarding LaPath dockable panel scaling on macOS Sonoma. Please check logs.', urgency: 'yellow' },
      { sender: 'Motion Science', senderEmail: 'cameron@motionscience.tv', title: 'Tutorial Collaboration Request', body: 'Hey Mykyta, would you be interested in sponsoring our next After Effects workflow masterclass?', urgency: 'yellow' },
      { sender: 'Gumroad Payouts', senderEmail: 'noreply@gumroad.com', title: 'Weekly Studio Payout Processed', body: 'Your weekly balance for preset packs and scripts has been transferred to your bank account.', urgency: 'grey' },
      { sender: 'Aescripts QA Team', senderEmail: 'qa@aescripts.com', title: 'CEP Extension Sign-off Successful', body: 'Automated sandbox testing for the latest build passed with 0 memory leaks. Ready for staging.', urgency: 'green' },
      { sender: 'Adobe Exchange', senderEmail: 'exchange-noreply@adobe.com', title: 'Extension Monthly Metrics Report', body: 'LaPath reached 4,200 active weekly instances across AE CC 2023-2025 users worldwide.', urgency: 'grey' },
      { sender: 'School of Motion', senderEmail: 'partners@schoolofmotion.com', title: 'Podcast Guest Invitation', body: 'We would love to have you on the Podcast to discuss custom tooling and scripting in After Effects.', urgency: 'yellow' },
      { sender: 'Aescripts Community', senderEmail: 'forum@aescripts.com', title: 'New Thread: Spline Curvature Request', body: 'A user posted a feature request for automatic Bezier tangent balancing in the forums.', urgency: 'grey' },
      { sender: 'Motion Design School', senderEmail: 'hello@motiondesign.school', title: 'Course Proposal Review', body: 'We reviewed the outline for your Advanced After Effects Expressions course. Let’s schedule a call.', urgency: 'red' },
    ],
    'rifemotion.com@gmail.com': [
      { sender: 'Vertex Motion Agency', senderEmail: 'contact@vertex-motion.com', title: 'Commercial Collaboration Offer (Nike 30s)', body: 'Hi Mykyta! We would love to hire you for lead 3D kinetic typography on a 30s commercial.', urgency: 'red' },
      { sender: 'Tokyo AI Robotics', senderEmail: 'kenji@robotics.tokyo', title: 'Rebranding Visual Identity Shot Pitch', body: 'Inquiry regarding 3D motion identity for our next hardware keynote reveal in Shibuya.', urgency: 'red' },
      { sender: 'Apple Music Creative', senderEmail: 'motion-inbound@apple.com', title: 'Artist Album Canvas NDA & Brief', body: 'Please review the attached NDA for upcoming animated album artwork on Apple Music.', urgency: 'red' },
      { sender: 'Buck Studio NY', senderEmail: 'talent@buck.co', title: 'Freelance Roster Availability Q3/Q4', body: 'Hey Mykyta, checking in on your freelance availability for remote motion design contracts.', urgency: 'yellow' },
      { sender: 'Oddfellows', senderEmail: 'producers@oddfellows.tv', title: 'Brand Anthem Kinetic Sequences', body: 'We have a 4-week sprint starting next month and need your character easing & typography skills.', urgency: 'yellow' },
      { sender: 'Strikers Studio', senderEmail: 'inbox@strikers.studio', title: 'Showreel Feedback & Collab', body: 'Huge fan of your latest easing breakdown reel. Would love to partner on upcoming client 3D teasers.', urgency: 'grey' },
      { sender: 'Giant Ant', senderEmail: 'jobs@giantant.ca', title: 'Guest Artist Spotlight', body: 'We are curating an internal design talk on scripting workflows and would love you to share tips.', urgency: 'grey' },
      { sender: 'Tendril Design', senderEmail: 'hello@tendril.ca', title: 'Houdini / Cinema 4D Motion Inquiry', body: 'Checking your availability for procedural animation and complex typography sequences.', urgency: 'yellow' },
      { sender: 'Hyperquake', senderEmail: 'studio@hyperquake.com', title: 'Brand Launch Identity System', body: 'Client approved the moodboard. We are ready to move forward with the animation contract.', urgency: 'red' },
      { sender: 'ManvsMachine', senderEmail: 'talent@manvsmachine.co.uk', title: 'Freelance Motion Designer Inquiry', body: 'Hey! Loved your recent portfolio updates. Are you open for a 2-week commercial booking?', urgency: 'yellow' },
    ],
    'nikitasolodkij3@gmail.com': [
      { sender: 'Google Cloud Billing', senderEmail: 'cloud-billing@google.com', title: 'Gemini Flash API Invoice Settled', body: 'Your monthly Google Cloud Platform charges have been automatically settled.', urgency: 'green' },
      { sender: 'GitHub Notifications', senderEmail: 'notifications@github.com', title: 'Security Alert: Dependency Upgrade', body: 'Dependabot submitted a PR to bump next to 14.2.35 in rifemotion.com repository.', urgency: 'grey' },
      { sender: 'Vercel Deployment', senderEmail: 'notifications@vercel.com', title: 'Deployment Succeeded: rifemotion.com', body: 'Production build main (ea060ba) successfully deployed to edge network in 420ms.', urgency: 'green' },
      { sender: 'Namecheap Support', senderEmail: 'support@namecheap.com', title: 'Domain Auto-Renewal Notice: rifemotion.com', body: 'Your domain name rifemotion.com is scheduled for auto-renewal next year. No action needed.', urgency: 'grey' },
      { sender: 'Cloudflare Worker', senderEmail: 'alerts@cloudflare.com', title: 'Worker KV Latency & Quota Nominal', body: 'Your KV database handled 18,400 read requests this month with 0 throttles.', urgency: 'grey' },
      { sender: 'Spotify Premium', senderEmail: 'no-reply@spotify.com', title: 'Monthly Family Subscription Receipt', body: 'Thank you for your payment. Your receipt for Spotify Premium has been processed.', urgency: 'grey' },
      { sender: 'Steam Games', senderEmail: 'noreply@steampowered.com', title: 'Wishlist Item On Sale: Cyberpunk 2077', body: 'An item on your Steam wishlist is currently 50% off during the summer sale.', urgency: 'grey' },
      { sender: 'Airbnb Support', senderEmail: 'automated@airbnb.com', title: 'Booking Confirmation for Warsaw Stay', body: 'Your reservation details and host check-in instructions are ready for review.', urgency: 'yellow' },
      { sender: 'Uber Receipts', senderEmail: 'uber.poland@uber.com', title: 'Your Trip Receipt: Central Station', body: 'Thanks for riding with Uber. Total: 28.50 PLN. Download tax invoice in PDF.', urgency: 'grey' },
      { sender: 'Allegro Smart', senderEmail: 'powiadomienia@allegro.pl', title: 'Paczka została nadana w Paczkomacie', body: 'Twoja przesyłka z kablem DisplayPort 2.1 wyruszyła w drogę do Paczkomatu.', urgency: 'green' },
    ],
    'nekitsolodkij@gmail.com': [
      { sender: 'Adobe Creative Cloud', senderEmail: 'exchange-support@adobe.com', title: 'LaPath 1.2.0 Approved on Exchange', body: 'Your update passed automated validation and is live worldwide on Adobe Exchange.', urgency: 'green' },
      { sender: 'Maxon Redshift', senderEmail: 'licensing@maxon.net', title: 'Cinema 4D + Redshift License Active', body: 'Your annual subscription has been renewed. High-performance GPU rendering enabled.', urgency: 'grey' },
      { sender: 'Autodesk Maya', senderEmail: 'accounts@autodesk.com', title: 'Student Educator License Verification', body: 'Your educational license status with PJATK university has been verified for 12 months.', urgency: 'green' },
      { sender: 'SideFX Houdini', senderEmail: 'support@sidefx.com', title: 'Houdini Indie 20.5 Build Available', body: 'Download the latest production build featuring enhanced Solaris Karma render delegates.', urgency: 'grey' },
      { sender: 'Discord Notifications', senderEmail: 'noreply@discord.com', title: 'Motion Designers Guild Digest', body: 'Catch up on top trending expressions and kinetic typography breakdowns this week.', urgency: 'grey' },
      { sender: 'Telegram Web', senderEmail: 'login@telegram.org', title: 'New Web Session Authorized', body: 'Your account @rifemotion authorized a new session from Warsaw, Poland (Edge Browser).', urgency: 'grey' },
      { sender: 'Epic Games Unreal', senderEmail: 'unreal@epicgames.com', title: 'Unreal Engine 5.4 Motion Design Kit', body: 'Check out the new Avalanche 2D/3D broadcast motion graphics toolset in Unreal Engine 5.4.', urgency: 'yellow' },
      { sender: 'ArtStation Trends', senderEmail: 'digest@artstation.com', title: 'Staff Pick: Kinetic Typography Showcase', body: 'Your recent project was featured in the curated 3D Motion Graphics channel.', urgency: 'green' },
      { sender: 'Behance Portfolio', senderEmail: 'notifications@behance.net', title: 'Your Project received 450 Appreciations', body: 'LaPath Branding & Tool Identity is trending on Behance Interaction Design feed.', urgency: 'green' },
      { sender: 'Patreon Creators', senderEmail: 'creator@patreon.com', title: 'Monthly Motion Pack Download Stats', body: '128 patrons downloaded your After Effects easing curve master templates.', urgency: 'grey' },
    ],
    'nekitbanking@gmail.com': [
      { sender: 'Santander Bank Polska', senderEmail: 'powiadomienia@santander.pl', title: 'Miesięczny wyciąg firmowy i VAT', body: 'Zestawienie operacji bankowych oraz wyciąg VAT za ubiegły okres są gotowe w Santander24.', urgency: 'grey' },
      { sender: 'mBank Biznes', senderEmail: 'kontakt@mbank.pl', title: 'Potwierdzenie przelewu zagranicznego SWIFT', body: 'Otrzymano płatność przychodzącą w walucie USD od Aescripts & Aeplugins LLC.', urgency: 'green' },
      { sender: 'Urząd Skarbowy', senderEmail: 'e-urzad@mf.gov.pl', title: 'Potwierdzenie UPO: Deklaracja PIT/VAT', body: 'Urzędowe Poświadczenie Odbioru dla złożonej deklaracji podatkowej zostało wygenerowane.', urgency: 'green' },
      { sender: 'Revolut Business', senderEmail: 'business@revolut.com', title: 'Wymiana walutowa EUR/PLN zrealizowana', body: 'Zlecenie automatycznej wymiany po kursie 4.28 PLN zostało pomyślnie zrealizowane.', urgency: 'grey' },
      { sender: 'Santander24 Alert', senderEmail: 'security@santander.pl', title: 'Logowanie do bankowości elektronicznej', body: 'Zarejestrowano pomyślne logowanie do serwisu Santander24 z adresu IP w Warszawie.', urgency: 'grey' },
      { sender: 'Księgowość infakt.pl', senderEmail: 'faktury@infakt.pl', title: 'Faktura sprzedaży #FV/2026/08/14', body: 'Klient opłacił fakturę za usługi projektowania animacji 3D. Status: Opłacona.', urgency: 'green' },
      { sender: 'ZUS PUE', senderEmail: 'pue-powiadomienia@zus.pl', title: 'Nowy dokument w skrzynce PUE ZUS', body: 'Informacja o stanie konta ubezpieczonego oraz rozliczeniu składek za bieżący miesiąc.', urgency: 'grey' },
      { sender: 'PayPal Merchant', senderEmail: 'service@paypal.com', title: 'Otrzymano płatność za licencję CEP', body: 'Użytkownik przelał środki za komercyjną licencję wtyczki After Effects.', urgency: 'green' },
      { sender: 'Stripe Payments', senderEmail: 'receipts@stripe.com', title: 'Daily Payout Scheduled: 3,450.00 PLN', body: 'Your automated daily payout is on its way to Santander Bank ending in 4102.', urgency: 'green' },
      { sender: 'Mastercard Secure', senderEmail: 'alerts@mastercard.com', title: 'Płatność zbliżeniowa kartą firmową', body: 'Autoryzowano płatność kartą w kwocie 149.00 PLN za subskrypcję oprogramowania.', urgency: 'grey' },
    ],
    's37167@pjwstk.edu.pl': [
      { sender: 'PJATK Dziekanat', senderEmail: 'dziekanat@pjwstk.edu.pl', title: 'Wyniki egzaminu z Analizy i Grafiki 3D', body: 'Cześć Mykyta! Oceny z egzaminu oraz projektu końcowego z Grafiki zostały wpisane do systemu Edukacja.', urgency: 'yellow' },
      { sender: 'Prof. dr hab. Kowalski', senderEmail: 'jkowalski@pjwstk.edu.pl', title: 'Konsultacje w sprawie pracy dyplomowej', body: 'Proszę o przesłanie zaktualizowanego konspektu animacji 3D oraz bibliografii do piątku.', urgency: 'red' },
      { sender: 'Biblioteka Główna PJATK', senderEmail: 'biblioteka@pjwstk.edu.pl', title: 'Dostęp do bazy IEEE Xplore & ACM', body: 'Twoje konto studenckie ma aktywny pełny dostęp do publikacji naukowych z grafiki komputerowej.', urgency: 'grey' },
      { sender: 'Samorząd Studentów PJATK', senderEmail: 'samorzad@pjwstk.edu.pl', title: 'Warsztaty: Zaawansowany Rendering GPU', body: 'Zapraszamy na bezpłatne warsztaty laboratoryjne z optymalizacji shaderów i oświetlenia.', urgency: 'grey' },
      { sender: 'Biuro Karier PJATK', senderEmail: 'biurokarier@pjwstk.edu.pl', title: 'Oferta stażu: Lead 3D Generalist (Warszawa)', body: 'Studio gier poszukuje studenta 3/4 roku do zespołu animacji cinematics.', urgency: 'yellow' },
      { sender: 'System Edukacja PJATK', senderEmail: 'edukacja-noreply@pjwstk.edu.pl', title: 'Plan zajęć na semestr zimowy 2026/2027', body: 'Wstępny harmonogram zajęć laboratoryjnych i wykładów został opublikowany w portalu.', urgency: 'grey' },
      { sender: 'Laboratorium VR/AR', senderEmail: 'vr-lab@pjwstk.edu.pl', title: 'Rezerwacja stanowiska Motion Capture', body: 'Twoja rezerwacja studia MoCap na środę w godzinach 14:00 - 18:00 została potwierdzona.', urgency: 'green' },
      { sender: 'Dział Stypendiów PJATK', senderEmail: 'stypendia@pjwstk.edu.pl', title: 'Decyzja w sprawie stypendium rektora', body: 'Decyzja o przyznaniu stypendium za osiągnięcia artystyczne i naukowe jest gotowa do odbioru.', urgency: 'green' },
      { sender: 'Koło Naukowe ShaderLab', senderEmail: 'shaderlab@pjwstk.edu.pl', title: 'Hackathon Grafiki Czasu Rzeczywistego', body: 'Dołącz do zespołu projektowego na 48-godzinny maraton tworzenia interaktywnych instalacji wizualnych.', urgency: 'yellow' },
      { sender: 'Kwestura PJATK', senderEmail: 'kwestura@pjwstk.edu.pl', title: 'Potwierdzenie rozliczenia czesnego', body: 'Wpłata za czesne została pomyślnie zaksięgowana na Twoim indywidualnym subkoncie studenta.', urgency: 'grey' }
    ]
  };

  const templates = templatesByAccount[accountEmail] || [];
  // Generate 20 items by expanding variations
  for (let i = 0; i < 20; i++) {
    const tmpl = templates[i % templates.length];
    const hourOffset = (i * 3.5) + (Math.random() * 2);
    const itemDate = new Date(now - hourOffset * msInHour).toISOString();
    const isRead = i > 4; // first 4-5 are unread
    list.push({
      id: `msg_${accountEmail.replace(/[^a-zA-Z0-9]/g, '_')}_${i+1}`,
      platform: 'gmail',
      account: accountName,
      accountEmail: accountEmail,
      sender: tmpl.sender,
      senderEmail: tmpl.senderEmail,
      shortTitle: tmpl.title,
      subject: tmpl.title,
      body: tmpl.body,
      urgency: tmpl.urgency,
      read: isRead,
      date: itemDate,
      url: 'https://mail.google.com'
    });
  }

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
      // Auto populate initial 20 per account
      const accounts = [
        { name: 'Work (Aescripts)', email: 'rifemotion.info@gmail.com' },
        { name: 'Motion Studio', email: 'rifemotion.com@gmail.com' },
        { name: 'Personal 1', email: 'nikitasolodkij3@gmail.com' },
        { name: 'Personal 2', email: 'nekitsolodkij@gmail.com' },
        { name: 'Banking & Finance', email: 'nekitbanking@gmail.com' },
        { name: 'PJATK University', email: 's37167@pjwstk.edu.pl' },
      ];
      messages = [];
      accounts.forEach(acc => {
        messages.push(...generate20MessagesForAccount(acc.name, acc.email));
      });
      messages.sort((a, b) => new Date(b.date) - new Date(a.date));
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
    const accounts = [
      { name: 'Work (Aescripts)', email: 'rifemotion.info@gmail.com' },
      { name: 'Motion Studio', email: 'rifemotion.com@gmail.com' },
      { name: 'Personal 1', email: 'nikitasolodkij3@gmail.com' },
      { name: 'Personal 2', email: 'nekitsolodkij@gmail.com' },
      { name: 'Banking & Finance', email: 'nekitbanking@gmail.com' },
      { name: 'PJATK University', email: 's37167@pjwstk.edu.pl' },
    ];
    const messages = [];
    accounts.forEach(acc => {
      messages.push(...generate20MessagesForAccount(acc.name, acc.email));
    });
    messages.sort((a, b) => new Date(b.date) - new Date(a.date));
    db.messages = messages;
    await saveDb(db);

    return NextResponse.json({ ok: true, messages, syncedCount: messages.length });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
