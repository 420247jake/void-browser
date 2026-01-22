import { DemoNode, DemoEdge } from './types';

// Generate position in a sphere
function randomSpherePosition(radius: number = 30): [number, number, number] {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = radius * Math.cbrt(Math.random());
  return [
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi)
  ];
}

// Cluster position around a center point
function clusterPosition(center: [number, number, number], spread: number = 8): [number, number, number] {
  return [
    center[0] + (Math.random() - 0.5) * spread,
    center[1] + (Math.random() - 0.5) * spread,
    center[2] + (Math.random() - 0.5) * spread
  ];
}

// Large pool of sample sites organized by category
const SITE_POOL = {
  tech: [
    { url: "https://github.com", title: "GitHub", domain: "github.com" },
    { url: "https://gitlab.com", title: "GitLab", domain: "gitlab.com" },
    { url: "https://stackoverflow.com", title: "Stack Overflow", domain: "stackoverflow.com" },
    { url: "https://dev.to", title: "DEV Community", domain: "dev.to" },
    { url: "https://hashnode.com", title: "Hashnode", domain: "hashnode.com" },
    { url: "https://codepen.io", title: "CodePen", domain: "codepen.io" },
    { url: "https://replit.com", title: "Replit", domain: "replit.com" },
    { url: "https://codesandbox.io", title: "CodeSandbox", domain: "codesandbox.io" },
    { url: "https://jsfiddle.net", title: "JSFiddle", domain: "jsfiddle.net" },
    { url: "https://glitch.com", title: "Glitch", domain: "glitch.com" },
  ],
  news: [
    { url: "https://news.ycombinator.com", title: "Hacker News", domain: "ycombinator.com" },
    { url: "https://techcrunch.com", title: "TechCrunch", domain: "techcrunch.com" },
    { url: "https://theverge.com", title: "The Verge", domain: "theverge.com" },
    { url: "https://arstechnica.com", title: "Ars Technica", domain: "arstechnica.com" },
    { url: "https://wired.com", title: "WIRED", domain: "wired.com" },
    { url: "https://engadget.com", title: "Engadget", domain: "engadget.com" },
    { url: "https://mashable.com", title: "Mashable", domain: "mashable.com" },
    { url: "https://gizmodo.com", title: "Gizmodo", domain: "gizmodo.com" },
    { url: "https://cnet.com", title: "CNET", domain: "cnet.com" },
    { url: "https://zdnet.com", title: "ZDNet", domain: "zdnet.com" },
  ],
  social: [
    { url: "https://twitter.com", title: "X (Twitter)", domain: "twitter.com" },
    { url: "https://reddit.com", title: "Reddit", domain: "reddit.com" },
    { url: "https://discord.com", title: "Discord", domain: "discord.com" },
    { url: "https://slack.com", title: "Slack", domain: "slack.com" },
    { url: "https://linkedin.com", title: "LinkedIn", domain: "linkedin.com" },
    { url: "https://mastodon.social", title: "Mastodon", domain: "mastodon.social" },
    { url: "https://tumblr.com", title: "Tumblr", domain: "tumblr.com" },
    { url: "https://pinterest.com", title: "Pinterest", domain: "pinterest.com" },
    { url: "https://threads.net", title: "Threads", domain: "threads.net" },
    { url: "https://bluesky.app", title: "Bluesky", domain: "bluesky.app" },
  ],
  entertainment: [
    { url: "https://youtube.com", title: "YouTube", domain: "youtube.com" },
    { url: "https://twitch.tv", title: "Twitch", domain: "twitch.tv" },
    { url: "https://spotify.com", title: "Spotify", domain: "spotify.com" },
    { url: "https://soundcloud.com", title: "SoundCloud", domain: "soundcloud.com" },
    { url: "https://netflix.com", title: "Netflix", domain: "netflix.com" },
    { url: "https://imdb.com", title: "IMDb", domain: "imdb.com" },
    { url: "https://rottentomatoes.com", title: "Rotten Tomatoes", domain: "rottentomatoes.com" },
    { url: "https://vimeo.com", title: "Vimeo", domain: "vimeo.com" },
    { url: "https://dailymotion.com", title: "Dailymotion", domain: "dailymotion.com" },
    { url: "https://crunchyroll.com", title: "Crunchyroll", domain: "crunchyroll.com" },
  ],
  ai: [
    { url: "https://openai.com", title: "OpenAI", domain: "openai.com" },
    { url: "https://anthropic.com", title: "Anthropic", domain: "anthropic.com" },
    { url: "https://claude.ai", title: "Claude", domain: "claude.ai" },
    { url: "https://chat.openai.com", title: "ChatGPT", domain: "openai.com" },
    { url: "https://midjourney.com", title: "Midjourney", domain: "midjourney.com" },
    { url: "https://stability.ai", title: "Stability AI", domain: "stability.ai" },
    { url: "https://huggingface.co", title: "Hugging Face", domain: "huggingface.co" },
    { url: "https://replicate.com", title: "Replicate", domain: "replicate.com" },
    { url: "https://perplexity.ai", title: "Perplexity", domain: "perplexity.ai" },
    { url: "https://cohere.com", title: "Cohere", domain: "cohere.com" },
  ],
  tools: [
    { url: "https://notion.so", title: "Notion", domain: "notion.so" },
    { url: "https://figma.com", title: "Figma", domain: "figma.com" },
    { url: "https://canva.com", title: "Canva", domain: "canva.com" },
    { url: "https://trello.com", title: "Trello", domain: "trello.com" },
    { url: "https://asana.com", title: "Asana", domain: "asana.com" },
    { url: "https://airtable.com", title: "Airtable", domain: "airtable.com" },
    { url: "https://miro.com", title: "Miro", domain: "miro.com" },
    { url: "https://dropbox.com", title: "Dropbox", domain: "dropbox.com" },
    { url: "https://1password.com", title: "1Password", domain: "1password.com" },
    { url: "https://zoom.us", title: "Zoom", domain: "zoom.us" },
  ],
  hosting: [
    { url: "https://vercel.com", title: "Vercel", domain: "vercel.com" },
    { url: "https://netlify.com", title: "Netlify", domain: "netlify.com" },
    { url: "https://cloudflare.com", title: "Cloudflare", domain: "cloudflare.com" },
    { url: "https://aws.amazon.com", title: "AWS", domain: "amazon.com" },
    { url: "https://cloud.google.com", title: "Google Cloud", domain: "google.com" },
    { url: "https://azure.microsoft.com", title: "Azure", domain: "microsoft.com" },
    { url: "https://digitalocean.com", title: "DigitalOcean", domain: "digitalocean.com" },
    { url: "https://heroku.com", title: "Heroku", domain: "heroku.com" },
    { url: "https://railway.app", title: "Railway", domain: "railway.app" },
    { url: "https://render.com", title: "Render", domain: "render.com" },
  ],
  learning: [
    { url: "https://udemy.com", title: "Udemy", domain: "udemy.com" },
    { url: "https://coursera.org", title: "Coursera", domain: "coursera.org" },
    { url: "https://freecodecamp.org", title: "freeCodeCamp", domain: "freecodecamp.org" },
    { url: "https://codecademy.com", title: "Codecademy", domain: "codecademy.com" },
    { url: "https://edx.org", title: "edX", domain: "edx.org" },
    { url: "https://khanacademy.org", title: "Khan Academy", domain: "khanacademy.org" },
    { url: "https://pluralsight.com", title: "Pluralsight", domain: "pluralsight.com" },
    { url: "https://skillshare.com", title: "Skillshare", domain: "skillshare.com" },
    { url: "https://frontendmasters.com", title: "Frontend Masters", domain: "frontendmasters.com" },
    { url: "https://egghead.io", title: "Egghead", domain: "egghead.io" },
  ],
  docs: [
    { url: "https://developer.mozilla.org", title: "MDN Web Docs", domain: "mozilla.org" },
    { url: "https://docs.github.com", title: "GitHub Docs", domain: "github.com" },
    { url: "https://reactjs.org", title: "React", domain: "reactjs.org" },
    { url: "https://vuejs.org", title: "Vue.js", domain: "vuejs.org" },
    { url: "https://angular.io", title: "Angular", domain: "angular.io" },
    { url: "https://svelte.dev", title: "Svelte", domain: "svelte.dev" },
    { url: "https://nextjs.org", title: "Next.js", domain: "nextjs.org" },
    { url: "https://tailwindcss.com", title: "Tailwind CSS", domain: "tailwindcss.com" },
    { url: "https://nodejs.org", title: "Node.js", domain: "nodejs.org" },
    { url: "https://rust-lang.org", title: "Rust", domain: "rust-lang.org" },
  ],
  gaming: [
    { url: "https://store.steampowered.com", title: "Steam", domain: "steampowered.com" },
    { url: "https://epicgames.com", title: "Epic Games", domain: "epicgames.com" },
    { url: "https://itch.io", title: "itch.io", domain: "itch.io" },
    { url: "https://gog.com", title: "GOG", domain: "gog.com" },
    { url: "https://ign.com", title: "IGN", domain: "ign.com" },
    { url: "https://gamespot.com", title: "GameSpot", domain: "gamespot.com" },
    { url: "https://kotaku.com", title: "Kotaku", domain: "kotaku.com" },
    { url: "https://pcgamer.com", title: "PC Gamer", domain: "pcgamer.com" },
    { url: "https://unity.com", title: "Unity", domain: "unity.com" },
    { url: "https://unrealengine.com", title: "Unreal Engine", domain: "unrealengine.com" },
  ],
};

// Shuffle array using Fisher-Yates
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Pick random items from array
function pickRandom<T>(array: T[], count: number): T[] {
  return shuffle(array).slice(0, count);
}

// Generate random cluster centers
function generateClusterCenters(count: number): [number, number, number][] {
  const centers: [number, number, number][] = [];
  for (let i = 0; i < count; i++) {
    centers.push(randomSpherePosition(25));
  }
  return centers;
}

// Generate a unique random graph for this session
function generateRandomGraph(): { nodes: DemoNode[], edges: DemoEdge[] } {
  const categories = Object.keys(SITE_POOL) as (keyof typeof SITE_POOL)[];
  const selectedCategories = pickRandom(categories, 5 + Math.floor(Math.random() * 3)); // 5-7 categories
  
  const clusterCenters = generateClusterCenters(selectedCategories.length);
  const nodes: DemoNode[] = [];
  const edges: DemoEdge[] = [];
  
  let nodeId = 1;
  let edgeId = 1;
  
  // Track nodes by category for cross-linking
  const categoryNodes: Record<string, string[]> = {};
  
  selectedCategories.forEach((category, catIndex) => {
    const sitesInCategory = SITE_POOL[category];
    const selectedSites = pickRandom(sitesInCategory, 3 + Math.floor(Math.random() * 4)); // 3-6 sites per category
    const center = clusterCenters[catIndex];
    
    categoryNodes[category] = [];
    
    selectedSites.forEach((site, siteIndex) => {
      const id = String(nodeId++);
      const position = siteIndex === 0 ? center : clusterPosition(center, 10);
      
      nodes.push({
        id,
        url: site.url,
        title: site.title,
        domain: site.domain,
        favicon: `https://${site.domain}/favicon.ico`,
        position,
        isAlive: true,
      });
      
      categoryNodes[category].push(id);
      
      // Connect to first node in cluster (hub)
      if (siteIndex > 0) {
        edges.push({
          id: `e${edgeId++}`,
          source: categoryNodes[category][0],
          target: id,
        });
      }
      
      // Random internal connections
      if (siteIndex > 1 && Math.random() > 0.5) {
        const randomPrev = categoryNodes[category][Math.floor(Math.random() * siteIndex)];
        if (randomPrev !== id) {
          edges.push({
            id: `e${edgeId++}`,
            source: randomPrev,
            target: id,
          });
        }
      }
    });
  });
  
  // Add cross-category connections
  const catKeys = Object.keys(categoryNodes);
  for (let i = 0; i < catKeys.length; i++) {
    for (let j = i + 1; j < catKeys.length; j++) {
      if (Math.random() > 0.4) { // 60% chance of cross-link
        const sourceNodes = categoryNodes[catKeys[i]];
        const targetNodes = categoryNodes[catKeys[j]];
        const source = sourceNodes[Math.floor(Math.random() * sourceNodes.length)];
        const target = targetNodes[Math.floor(Math.random() * targetNodes.length)];
        edges.push({
          id: `e${edgeId++}`,
          source,
          target,
        });
      }
    }
  }
  
  return { nodes, edges };
}

// Generate the graph once when module loads (unique per page load)
const generatedGraph = generateRandomGraph();

export const SAMPLE_NODES: DemoNode[] = generatedGraph.nodes;
export const SAMPLE_EDGES: DemoEdge[] = generatedGraph.edges;

// Function to add a new node (for user input)
let nodeCounter = 1000;
export function createDemoNode(url: string, title?: string): DemoNode {
  const urlObj = new URL(url);
  const domain = urlObj.hostname.replace('www.', '');
  
  return {
    id: String(++nodeCounter),
    url,
    title: title || domain,
    domain,
    favicon: `https://${domain}/favicon.ico`,
    position: randomSpherePosition(40),
    isAlive: true,
  };
}
