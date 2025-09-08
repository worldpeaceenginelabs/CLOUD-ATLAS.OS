/*
# Method to determine the browser language and eventually change the title to a more fitting local variant
# In the bottom array you insert the variable key2name instead of the fixed string "Report Deceptive Packaging", just like this:
{ key: `2`, title: key2name, content: 'blablabla'} 

let browserlang = navigator.languages;
let key2name = "";

if ( browserlang.includes("de")) {
key2name = "Mogelpackung melden";
} else {
key2name = "Report Deceptive Packaging";
}


# Empty template
{ key: `12`,
    title: 'T.E.A.C.H.E.R.',
    content: '',
    href: 'https://www.unrealengine.com/metahuman',
    target: '_blank',
    avatar: 'fuzzy-avatar/key112.jpg?auto=compress'  
  }


*/

interface DappItem {
  key: string;
  title: string;
  content: string;
  href: string;
  target: string;
  avatar: string;
  color?: string;
  categorytext?: string;
  categorypic?: string;
}

const dappData: DappItem[] = [
  { key: `1`,
    title: 'DAPP/Iris.to - Social Networking Freedom',
    content: 'Here comes Iris. Iris is a social networking application that stores and indexes everything on the devices of its users and connects directly with peers who run the application - no corporate gatekeepers needed. Interface-wise, Iris is not too different from some existing social media. You can post texts, photos, videos, audio or other types of files into your feed. Funfact: This app is made by Martti Malmi. Without Martti Malmi, Bitcoin and cryptocurrencies may never have been developed. Malmi was the second developer behind Bitcoin after Satoshi Nakamoto, putting him at the forefront of the cryptocurrency movement.',
    href: 'https://iris.to',
    target: '_blank',
    avatar: 'fuzzy-avatar/key1.png?auto=compress',
    color: '#008450',    
    categorytext:'OPEN'},


    { key: `2`,
    title: "DAPP/REPORT DECEPTIVE PACKAGING (coming soon / help wanted)",
    content: 'Deceptive packaging occurs when a product\'s packaging misleads the customer in various ways, such as by providing incorrect information regarding quantity, size, shape, or content. A common example of deceptive packaging is when a product is packaged in a container that appears to be full, but is only half-filled and the empty space is not visible from the outside. This can be a disappointing experience for the customer upon opening the packaging, and does result in unnecessary waste and environmental pollution.)',
    href: 'https://github.com/worldpeaceenginelabs/METAVERSE-SEED',
    target: '_blank',
    avatar: 'fuzzy-avatar/key2.jpg?auto=compress',
    color: '#efb700',
    categorytext:'DEVELOP'},
    
    { key: `3`,
    title: 'Attention All Innovators',
    content: 'Whether you\'re a creator, developer, activist, or for-profit or non-profit entrepreneur from any sector!<br><br>Don\'t get hung up on the tools; pick what suits your flow. Elevate your concepts using <strong>Unreal Engine 5</strong> (Uses C++ as the primary programming language, with Blueprints for visual scripting, and also supports Python for scripting certain tasks.), <strong>Unity 3D</strong> (Uses C# as the primary programming language, with Unity Visual Scripting (Bolt) for visual scripting.), and/or <strong>HTML, CSS, JS, APIs</strong> (JAMstack), <strong>WASM</strong> (C, C++, C#, and Rust, but for the Web), or <strong>WebContainers</strong> (Node.js in the browser). Then continue with the settings icon in the top-right and do a pull-request.<br><br>Launch your creations to a global audience across various platforms—be it <strong>browsers, mobile devices, desktops, VR, or WebVR, right out of the box.</strong> Enjoy the liberty of creation, supported by a <strong>backend that scales automatically by 99%, free from any restrictive ties.</strong><br><br><strong>Lacking coding skills? No worries!</strong> Craft complete games and apps with ease using Blueprints in UE5, Bolt in Unity 3D, or you can use ChatGPT for applications based on the already existing components in the code on GitHub.<br><br>What\'s stopping you from unleashing your creativity today? Liberate yourself from the constraints of your surroundings and navigate through diverse projects as if they were realms within an expansive, unified digital universe.<br><br>Take the plunge and start creating now!',
    href: 'https://youtube.com/shorts/G0jctnM3HGA?feature=share',
    target: '_blank',
    avatar: 'fuzzy-avatar/developer.jpg?auto=compress',
    color: '#ffffff',
    categorypic:'./fuzzy-category/globe.jpg'},

    { key: `4`,
    title: 'Want to see more stuff thats on the future roadmap?',
    content: 'A collection of ideas and concepts which will be implemented as dapps into METAVERSE-DAO | CLOUD ATLAS. Feel free to copy-cat and develop whatever you want, but dont forget to hit me with the results.',
    href: 'https://worldpeaceengine.pubpub.org/pub/futurefeatures/release/82',
    target: '_blank',
    avatar: 'fuzzy-avatar/key4.jpg?auto=compress',
    color: '#ffffff',
    categorypic:'./fuzzy-category/globe.jpg'},

    { key: `5`,
    title: 'WORLD PEACE ENGINE LABS',
    content: 'WORLD PEACE ENGINE LABS is a public, radical-transparent, open-source, non-profit organization and home of METAVERSE-DAO | CLOUD ATLAS',
    href: 'https://worldpeaceenginelabs.org',
    target: '_blank',
    avatar: 'fuzzy-avatar/key5.jpg?auto=compress',
    color: '#ffffff',
    categorypic:'./fuzzy-category/globe.jpg'},



    { key: `6`,
    title: 'DAPP/D-NEWS (geolocated) - News made by the people, for the people... (coming soon / help wanted)',
    content: '"We carry devices that know a lot about us and know exactly where we are all the time, so why not deliver news, information and content based on who we are, what we like and where we are?" "Just by geolocating the fires and the events in the Amazon, many people felt closer" Credits: Eduardo Acquarone',
    href: 'https://github.com/worldpeaceenginelabs/METAVERSE-SEED',
    target: '_blank',
    avatar: 'fuzzy-avatar/key6.jpg?auto=compress',
    color: '#efb700',
    categorytext:'DEVELOP'},



  { key: `11`,
    title: 'An Open-Source Connectome you can navigate like a Virtual Library: Unleashing the Potential of Multitasking and Polymathy for All - regardless of their innate abilities or current proficiency levels.',
    content: 'Welcome to Cloud Atlas, a visionary project that transforms the way we interact with information and each other. At its heart lies a planetary collective-computer, a web application that mirrors our world through a digital lens. This virtual realm, a cartographic echo of reality, is ripe for exploration and enrichment.<br><br>The Home Screen provides digital governance through <strong>Crowd Engineering Missions:</strong> a sequence of <strong>brainstorming, petitioning, crowdfunding,</strong> and <strong>action events.</strong> This accelerates the transition from problem identification to solution implementation and realization, significantly <strong>reducing the time compared to traditional government processes.</strong><br><br>The <strong>Dapp Store</strong> is a dedicated space designed to prominently feature your digital creations, each uniquely associated with coordinates on the map. A coordinate can represent everything: <strong>posts, profiles, links, API, streams, live-stream, apps, games (including your Steam, Epic,... games), your non-profit business, your for-profit business</strong> - you name it - Literally! For mobile, desktop, AR, and VR out of the box!<br><br>As a contributor, your mission is to capture, refine, and narrate the essence of places, combating the fog of distortion with clarity and precision. By <strong>tethering playful Wikipedia narratives</strong> to their physical and temporal anchors, you <strong>become a guardian of truth,</strong> ensuring the digital and the real harmoniously align.<br><br>The Virtual Encyclopedia stands as a <strong>beacon of accountability,</strong> juxtaposing the actions of authorities against the pillars of human rights, legal frameworks, and global objectives. It scrutinizes the alignment of governance with the immutable standards of truth across diverse domains, from STEM to HASS, and beyond.<br><br>Joining Cloud Atlas means more than contributing to a database; it\'s about becoming a neuron in a collective consciousness that spans both AI and humanity. Traverse this open-source connectome, where decentralized computing and collaboration elevate our collective intellect.<br><br>Embrace the revolution. Decentralize. Connect. Enrich the Cloud Atlas.',
    href: 'https://youtu.be/r1y6uOEzkYI?si=sGhv3Q51tNmHPcBx',
    target: '_blank',
    avatar: 'fuzzy-avatar/key20.jpg?auto=compress',
    color: '#ffffff',
    categorypic:'./fuzzy-category/globe.jpg'},



  { key: `12`,
    title: 'DAPP/T.E.A.C.H.E.R. - The school system is dead, long live the school system... (coming soon / help wanted)',
    content: 'In many countries, <strong>homeschooling</strong> is permissible under certain conditions, typically requiring a qualified teacher. What could be more obvious than a digital teacher meeting these qualifications? Introducing **T.E.A.C.H.E.R**—a revolutionary educational system that redefines how we educate our children. With T.E.A.C.H.E.R, children engage with AI tailored to their interests, <strong>progressing at their own pace</strong>. Their learning is tracked in a <strong>personal curriculum</strong>, with suggestions for unexplored topics to ensure a comprehensive education.<br><br>Imagine a child mastering a 13-year syllabus in just 5 years, exploring advanced subjects like quantum physics and rocket science, or even pursuing a medical degree at the age of 14. With T.E.A.C.H.E.R, this is not just a dream, but a real possibility.<br><br>But there\'s more—our system has several advantages over traditional schooling. The curriculum is transparent, accessible online for parents and the public, fostering a democratic process through surveys, petitions, and crowdfunding. It\'s verifiable that the system is child-centric (open-source), and social circles are naturally formed, mitigating issues like bullying in school caused by compulsively mixing social circles. Children can strengthen their social bonds by spending more time with family and friends.<br><br>We acknowledge the importance of social interaction for adolescent development, but we advocate for it to be voluntary, with the freedom to disengage, which is not always an option in conventional schools.<br><br>A unique feature for kids in our system is the ability to design their teacher\'s appearance using Unreal\'s META-HUMAN, providing an early introduction to information technology and AI. In summary, T.E.A.C.H.E.R offers a tailored and efficient approach to education, empowering children to explore their interests and realize their full potential. With our system, your child sets the pace and chooses the topics.<br><br>Join us in revolutionizing education for a brighter future.',
    href: 'https://www.unrealengine.com/metahuman',
    target: '_blank',
    avatar: 'fuzzy-avatar/key12.jpg?auto=compress',
    color: '#efb700',
    categorytext:'DEVELOP'},



    
  { key: `13`,
  title: 'LEARN/CesiumJS - 3D geospatial visualization for the web (Want to try out every feature live on the globe? Hit this card!)',
  content: 'CesiumJS is an open source JavaScript library for creating world-class 3D globes and maps with the best possible performance, precision, visual quality, and ease of use. Developers across industries, from aerospace to smart cities to drones, use CesiumJS to create interactive web apps for sharing dynamic geospatial data. Built on open formats, CesiumJS is designed for robust interoperability and scaling for massive datasets.',
  href: 'https://sandcastle.cesium.com/',
  target: '_blank',
  avatar: 'fuzzy-avatar/key13.jpg?auto=compress',
  color: '#c9c6d0',
  categorytext:'LEARN'},



  { key: `14`,
  title: 'DAPP/D-HELPOUTS - Help when you need it over live video (coming soon / help wanted)',
  content: 'What if getting help for a computer glitch, a leaky pipe, or a homework problem was as easy as clicking a button? What if you could connect via real-time video to a music teacher or a yoga instructor from the comfort of your home? What if you could get someone knowledgeable to get you "unstuck" when you really need it? And why did Google not continue this project? Ours is pushing for the free sessions many individuals offered back then, but you are allowed to add a price tag too.',
  href: 'https://blog.google/products/google-plus/introducing-helpouts-help-when-you-need/',
  target: '_blank',
  avatar: 'fuzzy-avatar/key14.jpg?auto=compress',
  color: '#efb700',
  categorytext:'DEVELOP'},



  { key: `15`,
  title: 'DAPP/D-SPONTACTS (Spontaneous Contacts) - Spontacts is a social discovery application that connects various users for joint activities in a vicinity. (coming soon / help wanted)',
  content: 'On the leisure platform Spontacts you can discover numerous leisure activities in your area every day and join friendly people in your neighborhood. Whether you want to go out for a nice meal, drink a beer together after work, jog through the park together on the weekend, or spend a relaxing evening at the movies or a concert. All this and much more you can discover on Spontacts and experience with great leisure partners. Take part in meetings safely and easily or organize your own activities.',
  href: 'https://github.com/worldpeaceenginelabs/METAVERSE-SEED',
  target: '_blank',
  avatar: 'fuzzy-avatar/key15.jpg?auto=compress',
  color: '#efb700',
  categorytext:'DEVELOP'},



  { key: `16`,
  title: 'DAPP/D-COUCHSURFING - Meet locals around the world and stay overnight with them! (coming soon / help wanted)',
  content: 'CouchSurfing is a hospitality exchange service by which users can request homestays or interact with other people who are interested in travel. Hosts are not allowed to charge for lodging.',
  href: 'https://github.com/worldpeaceenginelabs/METAVERSE-SEED',
  target: '_blank',
  avatar: 'fuzzy-avatar/key16.jpg?auto=compress',
  color: '#efb700',
  categorytext:'DEVELOP'},



  { key: `17`,
  title: 'LEARN/JAMstack - "Jamstack" was originally cased as "JAMstack" where "JAM" stood for JavaScript, API & Markup',
  content: 'JavaScript: Dynamic functionalities are handled by JavaScript. There is no restriction on which framework or library you must use. APIs: Server side operations are abstracted into reusable APIs and accessed over HTTPS with JavaScript. These can be third party services or your custom function. MARKUP: Websites are served as static HTML files. These can be generated from source files, such as Markdown, using a Static Site Generator.',
  href: 'https://jamstack.wtf/',
  target: '_blank',
  avatar: 'fuzzy-avatar/key17.jpg?auto=compress',
  color: '#c9c6d0',
  categorytext:'LEARN'},



  { key: `18`,
  title: 'LEARN/Svelte - Forget frameworks, forget even the Svelte specifics',
  content: 'I actually "abuse" Svelte as a compiler only. I always start like npm install vite@latest, choose Svelte/TS, and use Javascript, HTML, CSS only (JAMstack) and NOTHING Svelte specific but the bindings 😍 The bundler rewards me with Vanilla JS at the end which can be dropped on edge(static but reactive), and npm run dev hot-reload does load in just milliseconds, even if the project gets bigger. The app itself is small and lightspeed.',
  href: 'https://svelte.dev/tutorial/basics',
  target: '_blank',
  avatar: 'fuzzy-avatar/key18.jpg?auto=compress',
  color: '#c9c6d0',
  categorytext:'LEARN'},

  { key: `19`,
    title: 'Available to Everyone! Sharing the same tools! - Who Do We Serve?',
    content: '<strong>- CITIZENS:</strong> Create and participate in local and global issues, brainstorm solutions, petition for eventually necessary permissions, and bring your ideas to life via Crowdfunding. (coming "Get paid for the subject you love!")<br><br><strong>- PROFESSIONALS, SCIENTISTS AND HOBBYISTS:</strong> Collaborate on research, projects, and funding opportunities with a global network of contributors.<br><br><strong>- STARTUPS:</strong> Utilize our platform to brainstorm, fund, and develop innovative products, services, solutions and initiatives.<br><br><strong>- NONPROFITS and NGOs:</strong> Leverage our platform to gather support, co-develop new initiatives with real-time feedback from those affected (also by your solutions).<br><br><strong>- BUSINESSES:</strong> Enhance Corporate Social Responsibility: Cultivate a deep connection with all stakeholders of your business through regular brainstorming sessions. These collaborations aim to refine processes, increasing profitability while simultaneously improving life quality, thus creating a win-win dynamic where genuine satisfaction leads to enhanced profitability. Drive Innovation Forward: Collaborate with your users to create new or evolve existing products and services, guiding their entire lifecycle towards sustainability and simultaneously reducing shelf warmers. Adopt a user-centric development process, leveraging the collective intelligence of millions—a true embodiment of Industry 4.0.<br><br><strong>- POLITICIANS AND POLICYMAKERS:</strong> Actively collaborate with citizens, semi-professionals, and professionals across various fields to source innovative solutions and gain a wide range of insights on both public and private issues.<br><br>The Cloud Atlas is dedicated to bridging the disparities between the affluent and the needy, the influential and the modest, the learned and the layperson. It champions the spirit of cooperation across every stratum of society. Envision a society where the insights of an ordinary individual, perhaps a youth, have the power to ignite a transformative idea in the minds of esteemed leaders and experts, potentially altering the course of history or safeguarding our future.',
    href: 'https://www.youtube.com/watch?v=_cfPY1QoMgY',
    target: '_blank',
    avatar: 'fuzzy-avatar/key21.jpg?auto=compress',
    color: '#ffffff',
    categorypic:'./fuzzy-category/globe.jpg'},

  ];

export default dappData;
