const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");

// Load environment variables
dotenv.config();

// Import models
const Enigma = require("../models/Enigma");
const Chronicle = require("../models/Chronicle");
const Fragment = require("../models/Fragment");
const Claim = require("../models/Claim");
const Waitlist = require("../models/Waitlist");
const KeeperProfile = require("../models/KeeperProfile");
const User = require("../models/User");

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/enigma-platform",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );
    console.log("✅ MongoDB Connected for seeding");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    process.exit(1);
  }
};

// Clear existing data
const clearData = async () => {
  console.log("🧹 Clearing existing data...");
  await Enigma.deleteMany({});
  await Chronicle.deleteMany({});
  await Fragment.deleteMany({});
  await Claim.deleteMany({});
  await Waitlist.deleteMany({});
  await KeeperProfile.deleteMany({});
  console.log("✅ Data cleared");
};

// Admin user ID from your data
const ADMIN_USER_ID = "693fb4231c0feac06191db1c";
const SABRI_USER_ID = "6940d3441c0feac06191dc72";
const OUSSAMA_USER_ID = "6966d379897c5c004eefb6a4";
const AMINE_USER_ID = "698e0223e6d27f91751ddbb9";

// Create Keeper Profiles for existing users
const createKeeperProfiles = async () => {
  console.log("👤 Creating keeper profiles...");

  const users = [
    {
      _id: ADMIN_USER_ID,
      firstName: "Wissem",
      lastName: "SAADLI",
      email: "wissem.saadli@sesame.com.tn",
      avatar:
        "https://lh3.googleusercontent.com/a/ACg8ocLYS7eywzhULOAv_m1SDTcnHRKbgE",
    },
    {
      _id: SABRI_USER_ID,
      firstName: "sabri",
      lastName: "slg",
      email: "sabrislougui@gmail.com",
    },
    {
      _id: OUSSAMA_USER_ID,
      firstName: "oussama",
      lastName: "gharsalli",
      email: "oussamamessi1899@gmail.com",
      avatar:
        "https://lh3.googleusercontent.com/a/ACg8ocIixE8NUmf1gL3MNM0Ye90cI6RXCj",
    },
    {
      _id: AMINE_USER_ID,
      firstName: "Amine",
      lastName: "Allagui",
      email: "amynallagui1@gmail.com",
    },
  ];

  for (const user of users) {
    await KeeperProfile.create({
      user: user._id,
      displayName: `${user.firstName} ${user.lastName}`,
      bio: `Passionate puzzle keeper and mystery solver.`,
      avatar: user.avatar || "",
      joinedAt: new Date(),
      reputation: Math.floor(Math.random() * 50) + 50, // 50-100
      stats: {
        fragmentsClaimed: 0,
        chroniclesCompleted: 0,
        mysteriesSolved: 0,
        totalSpent: 0,
        waitlistEntries: 0,
        claimsCount: 0,
        uniqueChronicles: 0,
      },
      preferences: {
        showActivity: true,
        showCollection: true,
        allowMessages: false,
      },
    });
  }

  console.log("✅ Keeper profiles created");
};

// Seed Enigmas
const seedEnigmas = async () => {
  console.log("📚 Seeding enigmas...");

  const enigmas = [
    {
      name: "Anime Chronicles",
      description: "Unravel the hidden truths behind legendary anime worlds",
      lore: `In the beginning, there were stories. Stories that transcended reality, creating worlds where the impossible became possible. These stories contained fragments of truth, pieces of a larger puzzle scattered across dimensions.

Those who possess the fragments become keepers of these truths. Each fragment holds a clue, and only when all fragments are united can the full mystery be revealed.

The journey begins with a single fragment, but it takes a community of keepers to piece together the complete picture. Will you be among those who solve the ultimate mystery?`,
      status: "active",
      difficulty: "intermediate",
      featured: true,
      startDate: new Date("2024-01-15"),
      estimatedEnd: new Date("2024-06-30"),
      creator: {
        name: "Arcane Weavers Collective",
        avatar: "https://images.unsplash.com/photo-1531259683007-016a7b628fc3",
        bio: "Masters of mystery and weavers of tales",
      },
      location: {
        country: "Virtual",
        city: "Digital Realm",
        virtual: true,
      },
      tags: ["Anime", "Collaborative", "Limited Edition", "NFT", "Exclusive"],
      coverImage: {
        url: "https://images.unsplash.com/photo-1635805737707-575885ab0820",
        alt: "Anime Chronicles cover",
        publicId: "anime-chronicles-cover",
      },
      bannerImage: {
        url: "https://images.unsplash.com/photo-1578662996442-48f60103fc96",
        alt: "Anime Chronicles banner",
        publicId: "anime-chronicles-banner",
      },
      rewards: [
        {
          name: "Arcane Artifact",
          description:
            "Limited edition physical artifact from the solved puzzle",
          type: "physical",
          rarity: "legendary",
        },
        {
          name: "Digital Grimoire",
          description: "Exclusive digital content and behind-the-scenes lore",
          type: "nft",
          rarity: "rare",
        },
        {
          name: "Keeper's Badge",
          description: "Special recognition on the leaderboard and community",
          type: "badge",
          rarity: "rare",
        },
        {
          name: "Next Enigma Access",
          description: "Early access to the next mystery before public release",
          type: "experience",
          rarity: "legendary",
        },
      ],
      stats: {
        activeKeepers: 32,
        totalValueLocked: 9596.68,
        completionRate: 71,
        averageTimeToComplete: 45,
      },
      metadata: {
        totalChronicles: 5,
        totalFragments: 45,
        fragmentsClaimed: 32,
      },
      seo: {
        title: "Anime Chronicles Mystery | Puzzle Platform",
        description: "Unravel hidden truths behind legendary anime worlds",
        keywords: ["anime", "mystery", "puzzle", "collectible", "fragments"],
      },
    },
    {
      name: "Mythology Enigmas",
      description:
        "Decode ancient myths and forgotten legends from around the world",
      lore: `Long before recorded history, the ancients hid their wisdom in stories. Myths were not mere tales but vessels carrying profound truths about existence, nature, and the cosmos.

Now, these ancient secrets have been fragmented across time and space, waiting for modern keepers to piece them together. Each fragment contains a piece of mythological wisdom, a clue to understanding our collective past.

Those who gather enough fragments will unlock the ultimate truth: that all myths are connected, telling one grand story of humanity's quest for meaning.`,
      status: "upcoming",
      difficulty: "advanced",
      featured: true,
      estimatedStartDate: new Date("2024-07-01"),
      estimatedEnd: new Date("2024-12-31"),
      creator: {
        name: "Mythos Guardians",
        avatar: "https://images.unsplash.com/photo-1531259683007-016a7b628fc3",
        bio: "Keepers of ancient wisdom",
      },
      location: {
        country: "Greece",
        city: "Athens",
        virtual: false,
      },
      tags: ["Mythology", "Ancient", "Legendary", "History"],
      coverImage: {
        url: "https://images.unsplash.com/photo-1531259683007-016a7b628fc3",
        alt: "Mythology Enigmas cover",
        publicId: "mythology-enigmas-cover",
      },
      bannerImage: {
        url: "https://images.unsplash.com/photo-1505664194779-8beaceb93744",
        alt: "Mythology Enigmas banner",
        publicId: "mythology-enigmas-banner",
      },
      rewards: [
        {
          name: "Ancient Coin Replica",
          description: "Authentic replica of an ancient mythological coin",
          type: "physical",
          rarity: "rare",
        },
        {
          name: "Mythological Codex",
          description:
            "Digital collection of mythological texts and interpretations",
          type: "nft",
          rarity: "common",
        },
      ],
      stats: {
        activeKeepers: 0,
        totalValueLocked: 0,
        completionRate: 0,
        averageTimeToComplete: 60,
      },
      metadata: {
        totalChronicles: 3,
        totalFragments: 27,
        fragmentsClaimed: 0,
      },
    },
    {
      name: "Sci-Fi Paradoxes",
      description: "Solve futuristic puzzles across time and space dimensions",
      lore: `The future is not set in stone. Every decision creates a new timeline, a new possibility. These paradoxes have been captured and fragmented, waiting for those brave enough to navigate the multiverse.

Each fragment represents a quantum state, a possible future, a decision point that could reshape reality. Collect them all to understand the true nature of time and choice.

But beware - some paradoxes can destroy the very fabric of existence if mishandled. Only the wisest keepers should attempt this journey.`,
      status: "upcoming",
      difficulty: "expert",
      featured: false,
      estimatedStartDate: new Date("2024-08-15"),
      estimatedEnd: new Date("2025-02-28"),
      creator: {
        name: "Quantum Mystics",
        avatar: "https://images.unsplash.com/photo-1446776653964-20c1d3a81b06",
        bio: "Explorers of the multiverse",
      },
      location: {
        virtual: true,
      },
      tags: ["Sci-Fi", "Quantum", "Multiverse", "Advanced"],
      coverImage: {
        url: "https://images.unsplash.com/photo-1446776653964-20c1d3a81b06",
        alt: "Sci-Fi Paradoxes cover",
        publicId: "scifi-paradoxes-cover",
      },
      bannerImage: {
        url: "https://images.unsplash.com/photo-1518709268805-4e9042af2176",
        alt: "Sci-Fi Paradoxes banner",
        publicId: "scifi-paradoxes-banner",
      },
      rewards: [
        {
          name: "Quantum Artifact",
          description:
            "Mysterious object that seems to exist in multiple states",
          type: "physical",
          rarity: "legendary",
        },
      ],
      stats: {
        activeKeepers: 0,
        totalValueLocked: 0,
        completionRate: 0,
        averageTimeToComplete: 90,
      },
      metadata: {
        totalChronicles: 4,
        totalFragments: 36,
        fragmentsClaimed: 0,
      },
    },
    {
      name: "Historical Cryptex",
      description: "Unlock secrets from pivotal moments in history",
      lore: `History is written by the victors, but truth is hidden in the details. Throughout time, key moments have been encrypted into physical objects, waiting for those with eyes to see.

From ancient Egyptian hieroglyphs to WWII Enigma machines, humanity has always hidden its most precious secrets. This enigma collects these historical mysteries, fragmenting them across time.

Assemble the fragments, decode the messages, and rewrite history as it was meant to be understood.`,
      status: "active",
      difficulty: "intermediate",
      featured: false,
      startDate: new Date("2024-02-01"),
      estimatedEnd: new Date("2024-08-31"),
      creator: {
        name: "Timekeepers Society",
        avatar: "https://images.unsplash.com/photo-1505664194779-8beaceb93744",
        bio: "Guardians of historical truth",
      },
      location: {
        country: "Multiple",
        virtual: false,
      },
      tags: ["History", "Cryptography", "Ancient", "Secrets"],
      coverImage: {
        url: "https://images.unsplash.com/photo-1505664194779-8beaceb93744",
        alt: "Historical Cryptex cover",
        publicId: "historical-cryptex-cover",
      },
      bannerImage: {
        url: "https://images.unsplash.com/photo-1531259683007-016a7b628fc3",
        alt: "Historical Cryptex banner",
        publicId: "historical-cryptex-banner",
      },
      rewards: [
        {
          name: "Replica Artifact",
          description: "Authentic replica of a historical encryption device",
          type: "physical",
          rarity: "rare",
        },
        {
          name: "Decoded Manuscripts",
          description: "Digital collection of decoded historical documents",
          type: "nft",
          rarity: "common",
        },
      ],
      stats: {
        activeKeepers: 48,
        totalValueLocked: 12000,
        completionRate: 89,
        averageTimeToComplete: 30,
      },
      metadata: {
        totalChronicles: 6,
        totalFragments: 54,
        fragmentsClaimed: 48,
      },
    },
    {
      name: "Fantasy Legends",
      description: "Navigate magical realms and mystical creatures",
      lore: `In realms beyond our own, magic flows like rivers and mythical creatures roam free. These fantasy worlds hold secrets that can reshape our understanding of reality.

Dragons guard ancient wisdom, elves preserve forgotten lore, and wizards channel powers beyond mortal comprehension. Their stories have been fragmented and scattered across the magical planes.

Those who collect enough fragments will gain access to the Grand Conclave, where the ultimate secret of magic itself will be revealed.`,
      status: "archived",
      difficulty: "beginner",
      featured: true,
      startDate: new Date("2023-09-01"),
      estimatedEnd: new Date("2024-01-31"),
      endDate: new Date("2024-01-31"),
      creator: {
        name: "Mystic Circle",
        avatar: "https://images.unsplash.com/photo-1518709268805-4e9042af2176",
        bio: "Weavers of magical tales",
      },
      location: {
        virtual: true,
      },
      tags: ["Fantasy", "Magic", "Dragons", "Elves", "Completed"],
      coverImage: {
        url: "https://images.unsplash.com/photo-1518709268805-4e9042af2176",
        alt: "Fantasy Legends cover",
        publicId: "fantasy-legends-cover",
      },
      bannerImage: {
        url: "https://images.unsplash.com/photo-1635805737707-575885ab0820",
        alt: "Fantasy Legends banner",
        publicId: "fantasy-legends-banner",
      },
      rewards: [
        {
          name: "Dragon Scale Replica",
          description: "Authentic replica of a dragon scale",
          type: "physical",
          rarity: "legendary",
        },
        {
          name: "Spellbook",
          description:
            "Digital grimoire containing magical spells and incantations",
          type: "nft",
          rarity: "rare",
        },
        {
          name: "Mage's Badge",
          description: "Special recognition in the Mage's Guild",
          type: "badge",
          rarity: "common",
        },
      ],
      stats: {
        activeKeepers: 36,
        totalValueLocked: 9000,
        completionRate: 100,
        averageTimeToComplete: 120,
      },
      metadata: {
        totalChronicles: 4,
        totalFragments: 36,
        fragmentsClaimed: 36,
      },
    },
    {
      name: "Cyber Enigma",
      description: "Hack through digital mysteries and virtual realities",
      lore: `In the neon-lit streets of the digital future, data is the new gold and secrets are currency. The Cyber Enigma captures the essence of this world, fragmenting it across the digital landscape.

Each fragment contains code snippets, encrypted messages, and digital artifacts that tell the story of a world where the line between human and machine blurs.

Only those who can navigate the digital underworld and decode the messages will uncover the truth about humanity's digital future.`,
      status: "active",
      difficulty: "advanced",
      featured: true,
      startDate: new Date("2024-03-01"),
      estimatedEnd: new Date("2024-09-30"),
      creator: {
        name: "Digital Mystics",
        avatar: "https://images.unsplash.com/photo-1518709268805-4e9042af2176",
        bio: "Explorers of the digital frontier",
      },
      location: {
        virtual: true,
      },
      tags: ["Cyberpunk", "Digital", "Hacking", "VR", "AI"],
      coverImage: {
        url: "https://images.unsplash.com/photo-1518709268805-4e9042af2176",
        alt: "Cyber Enigma cover",
        publicId: "cyber-enigma-cover",
      },
      bannerImage: {
        url: "https://images.unsplash.com/photo-1446776653964-20c1d3a81b06",
        alt: "Cyber Enigma banner",
        publicId: "cyber-enigma-banner",
      },
      rewards: [
        {
          name: "Neural Interface",
          description: "Limited edition neural interface device",
          type: "physical",
          rarity: "legendary",
        },
        {
          name: "Digital Art Collection",
          description: "Exclusive digital art from the cyber world",
          type: "nft",
          rarity: "rare",
        },
        {
          name: "Hacker's Badge",
          description: "Special recognition in the hacker community",
          type: "badge",
          rarity: "common",
        },
      ],
      stats: {
        activeKeepers: 15,
        totalValueLocked: 4500,
        completionRate: 56,
        averageTimeToComplete: 75,
      },
      metadata: {
        totalChronicles: 3,
        totalFragments: 27,
        fragmentsClaimed: 15,
      },
    },
  ];

  const createdEnigmas = await Enigma.insertMany(enigmas);
  console.log(`✅ Seeded ${createdEnigmas.length} enigmas`);
  return createdEnigmas;
};

// Seed Chronicles
const seedChronicles = async (enigmas) => {
  console.log("📖 Seeding chronicles...");

  const animeEnigma = enigmas.find((e) => e.name === "Anime Chronicles");
  const mythologyEnigma = enigmas.find((e) => e.name === "Mythology Enigmas");
  const scifiEnigma = enigmas.find((e) => e.name === "Sci-Fi Paradoxes");
  const historyEnigma = enigmas.find((e) => e.name === "Historical Cryptex");
  const fantasyEnigma = enigmas.find((e) => e.name === "Fantasy Legends");
  const cyberEnigma = enigmas.find((e) => e.name === "Cyber Enigma");

  const chronicles = [
    // Anime Chronicles Chronicles
    {
      enigma: animeEnigma._id,
      name: "The Straw Hat Legacy",
      description: "Unravel the mysteries of the Nine Straw Hats crew members",
      lore: `In the Grand Line, a legend speaks of nine individuals bound by fate, each carrying a fragment of a greater truth. Their journey, marked by laughter, tears, and unbreakable bonds, hides secrets that only the worthy can uncover.

This chronicle captures the essence of their adventure - nine fragments, nine stories, one ultimate mystery. Those who claim these fragments become part of the legend, guardians of secrets that could change the very fabric of reality.

Will you be the one to piece together the Straw Hat's ultimate truth?`,
      difficulty: "intermediate",
      status: "available",
      productionStatus: "awaiting",
      timeline: "6-8 weeks",
      basePrice: 299.99,
      location: {
        country: "Grand Line",
        virtual: true,
      },
      author: {
        name: "Mystery Weaver #42",
        role: "Chronicle Keeper",
      },
      featured: true,
      estimatedStartDate: new Date("2024-02-15"),
      estimatedCompletion: new Date("2024-04-01"),
      stats: {
        fragmentCount: 9,
        fragmentsClaimed: 3,
        requiredFragments: 9,
        uniqueKeepers: 3,
      },
      rewards: [
        {
          name: "Crew Member Artifact",
          description: "Limited edition crew member artifact",
          type: "physical",
          unlockThreshold: 9,
        },
        {
          name: "Digital Certificate",
          description: "Digital certificate of guardianship",
          type: "nft",
          unlockThreshold: 1,
        },
      ],
      waitlist: {
        enabled: true,
        maxCapacity: 100,
        currentCount: 0,
      },
    },
    {
      enigma: animeEnigma._id,
      name: "Naruto's Seal Mystery",
      description: "Decode the hidden seals across the ninja world",
      lore: `Hidden deep within the ninja villages lie ancient seals, each containing fragments of forgotten jutsu and hidden histories. The Hokage's legacy, the Uchiha tragedy, and the origin of chakra itself - all sealed away, waiting to be discovered.

This chronicle follows the path of the ninja way, with fragments representing key moments and characters from the hidden leaf village and beyond.

Will you unlock the secrets of the shinobi and become a true Hokage of mystery?`,
      difficulty: "advanced",
      status: "forging",
      productionStatus: "design",
      timeline: "In Production",
      basePrice: 349.99,
      location: {
        country: "Hidden Leaf Village",
        virtual: true,
      },
      author: {
        name: "Mystery Weaver #47",
        role: "Chronicle Keeper",
      },
      featured: false,
      estimatedStartDate: new Date("2024-01-15"),
      estimatedCompletion: new Date("2024-03-15"),
      stats: {
        fragmentCount: 12,
        fragmentsClaimed: 12,
        requiredFragments: 12,
        uniqueKeepers: 12,
      },
      rewards: [
        {
          name: "Ninja Artifact",
          description: "Authentic ninja tool replica",
          type: "physical",
          unlockThreshold: 12,
        },
      ],
      waitlist: {
        enabled: false,
        maxCapacity: 50,
        currentCount: 0,
      },
    },
    {
      enigma: animeEnigma._id,
      name: "Attack on Titan Walls",
      description: "Discover what lies beyond the three walls",
      lore: `Within the walls that protect humanity, secrets lie buried. The truth about the titans, the history of the world, and the key to humanity's survival are all hidden in fragments scattered across the walls.

This chronicle represents the struggle between humans and titans, with fragments containing clues about the world beyond the walls and the true nature of the titans.

When all fragments are assembled, the complete history of humanity will be revealed.`,
      difficulty: "expert",
      status: "cipher",
      productionStatus: "enchanting",
      timeline: "Active Cipher",
      basePrice: 399.99,
      location: {
        country: "Paradis Island",
        virtual: true,
      },
      author: {
        name: "Mystery Weaver #51",
        role: "Chronicle Keeper",
      },
      featured: true,
      estimatedStartDate: new Date("2023-12-01"),
      estimatedCompletion: new Date("2024-02-28"),
      stats: {
        fragmentCount: 3,
        fragmentsClaimed: 3,
        requiredFragments: 3,
        uniqueKeepers: 3,
      },
      rewards: [
        {
          name: "Survey Corps Badge",
          description: "Official Survey Corps badge replica",
          type: "physical",
          unlockThreshold: 3,
        },
      ],
      waitlist: {
        enabled: true,
        maxCapacity: 30,
        currentCount: 0,
      },
    },
    {
      enigma: animeEnigma._id,
      name: "Demon Slayer Corps",
      description: "Hunt demons with the breath techniques",
      difficulty: "intermediate",
      status: "available",
      productionStatus: "awaiting",
      timeline: "8-10 weeks",
      basePrice: 279.99,
      location: {
        country: "Taisho Era Japan",
        virtual: true,
      },
      author: {
        name: "Mystery Weaver #39",
        role: "Chronicle Keeper",
      },
      featured: false,
      estimatedStartDate: new Date("2024-03-15"),
      estimatedCompletion: new Date("2024-05-15"),
      stats: {
        fragmentCount: 9,
        fragmentsClaimed: 0,
        requiredFragments: 9,
        uniqueKeepers: 0,
      },
      rewards: [
        {
          name: "Nichirin Blade Replica",
          description: "Miniature Nichirin blade replica",
          type: "physical",
          unlockThreshold: 9,
        },
      ],
      waitlist: {
        enabled: true,
        maxCapacity: 80,
        currentCount: 12,
      },
    },
    {
      enigma: animeEnigma._id,
      name: "Dragon Ball Wishes",
      description: "Collect the dragon balls to unlock ultimate power",
      difficulty: "beginner",
      status: "solved",
      productionStatus: "delivered",
      timeline: "Archived",
      basePrice: 249.99,
      location: {
        country: "Earth",
        virtual: true,
      },
      author: {
        name: "Mystery Weaver #33",
        role: "Chronicle Keeper",
      },
      featured: false,
      endDate: new Date("2024-01-30"),
      stats: {
        fragmentCount: 7,
        fragmentsClaimed: 7,
        requiredFragments: 7,
        uniqueKeepers: 5,
      },
      rewards: [
        {
          name: "Dragon Ball Replica",
          description: "Set of 7 miniature dragon balls",
          type: "physical",
          unlockThreshold: 7,
        },
      ],
      waitlist: {
        enabled: false,
        maxCapacity: 0,
        currentCount: 0,
      },
    },
    {
      enigma: cyberEnigma._id,
      name: "Neural Interface",
      description: "Connect to the digital consciousness",
      difficulty: "advanced",
      status: "available",
      productionStatus: "awaiting",
      timeline: "10-12 weeks",
      basePrice: 449.99,
      location: {
        virtual: true,
      },
      author: {
        name: "Cyber Weaver #01",
        role: "Chronicle Keeper",
      },
      featured: true,
      estimatedStartDate: new Date("2024-03-20"),
      estimatedCompletion: new Date("2024-06-01"),
      stats: {
        fragmentCount: 15,
        fragmentsClaimed: 2,
        requiredFragments: 15,
        uniqueKeepers: 2,
      },
      rewards: [
        {
          name: "Neural Implant",
          description: "Limited edition neural interface device",
          type: "physical",
          unlockThreshold: 15,
        },
        {
          name: "Digital Avatar",
          description: "Custom digital avatar NFT",
          type: "nft",
          unlockThreshold: 5,
        },
      ],
      waitlist: {
        enabled: true,
        maxCapacity: 50,
        currentCount: 8,
      },
    },
  ];

  const createdChronicles = await Chronicle.insertMany(chronicles);
  console.log(`✅ Seeded ${createdChronicles.length} chronicles`);
  return createdChronicles;
};

// Seed Fragments
// ... (keep everything the same until the seedFragments function)

// Seed Fragments - UPDATED VERSION
const seedFragments = async (chronicles) => {
  console.log("🧩 Seeding fragments...");

  const strawHatChronicle = chronicles.find(
    (c) => c.name === "The Straw Hat Legacy"
  );
  const narutoChronicle = chronicles.find(
    (c) => c.name === "Naruto's Seal Mystery"
  );
  const aotChronicle = chronicles.find(
    (c) => c.name === "Attack on Titan Walls"
  );
  const demonSlayerChronicle = chronicles.find(
    (c) => c.name === "Demon Slayer Corps"
  );
  const dbChronicle = chronicles.find((c) => c.name === "Dragon Ball Wishes");
  const cyberChronicle = chronicles.find((c) => c.name === "Neural Interface");

  const fragments = [];

  // Straw Hat Legacy fragments (9 fragments)
  const strawHatNames = [
    "Luffy",
    "Zoro",
    "Nami",
    "Usopp",
    "Sanji",
    "Chopper",
    "Robin",
    "Franky",
    "Brook",
  ];
  const strawHatRarities = [
    "legendary",
    "rare",
    "common",
    "common",
    "rare",
    "common",
    "rare",
    "common",
    "common",
  ];

  for (let i = 0; i < 9; i++) {
    const isClaimed = i < 3; // First 3 are claimed
    fragments.push({
      chronicle: strawHatChronicle._id,
      number: i + 1,
      name: `Fragment #${i + 1} - ${strawHatNames[i]}`,
      description: `Represents ${strawHatNames[i]} with hidden clues woven into the design`,
      status: isClaimed ? "claimed" : "available",
      claimedBy: isClaimed
        ? i === 0
          ? ADMIN_USER_ID
          : i === 1
          ? SABRI_USER_ID
          : OUSSAMA_USER_ID
        : null,
      claimedAt: isClaimed ? new Date(Date.now() - i * 86400000) : null,
      price: 299.99 + i * 50,
      rarity: strawHatRarities[i],
      imageUrl: {
        url: `https://images.unsplash.com/photo-${
          1635805737700 + i
        }?auto=format&fit=crop&w=400&h=300&q=80`,
        alt: `Fragment ${i + 1} - ${strawHatNames[i]}`,
        publicId: `straw-hat-fragment-${i + 1}`,
      },
      features: [
        // Now as array of strings
        "Hidden QR code",
        "UV-reactive ink",
        "Embossed symbol",
        "Numbered certificate",
      ],
      clues: {
        revealed: isClaimed ? Math.floor(Math.random() * 3) + 1 : 0,
        total: 5,
        list: [],
      },
      estimatedDelivery: "6-8 weeks", // Now string, not date
      isFeatured: i === 4,
      metadata: {
        viewCount: Math.floor(Math.random() * 100) + 20,
      },
    });
  }

  // Naruto fragments (12 fragments) - all claimed
  for (let i = 0; i < 12; i++) {
    fragments.push({
      chronicle: narutoChronicle._id,
      number: i + 1,
      name: `Seal Fragment #${i + 1}`,
      description: `Contains ancient ninja seal markings and hidden techniques`,
      status: "claimed",
      claimedBy:
        i % 3 === 0
          ? ADMIN_USER_ID
          : i % 3 === 1
          ? SABRI_USER_ID
          : OUSSAMA_USER_ID,
      claimedAt: new Date(Date.now() - (i + 10) * 86400000),
      price: 349.99,
      rarity: i < 2 ? "legendary" : i < 5 ? "rare" : "common",
      imageUrl: {
        url: `https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=400&h=300&q=80`,
        alt: `Seal Fragment ${i + 1}`,
        publicId: `naruto-fragment-${i + 1}`,
      },
      features: [
        // Now as array of strings
        "Hidden jutsu symbols",
        "Chakra-reactive ink",
        "Clan markings",
        "Numbered certificate",
      ],
      clues: {
        revealed: 5,
        total: 5,
        list: [],
      },
      estimatedDelivery: "Delivered", // Now string, not date
      metadata: {
        viewCount: Math.floor(Math.random() * 150) + 50,
      },
    });
  }

  // AOT fragments (3 fragments) - all claimed
  for (let i = 0; i < 3; i++) {
    fragments.push({
      chronicle: aotChronicle._id,
      number: i + 1,
      name: `Wall ${i === 0 ? "Maria" : i === 1 ? "Rose" : "Sina"} Fragment`,
      description: `Contains secrets from within Wall ${
        i === 0 ? "Maria" : i === 1 ? "Rose" : "Sina"
      }`,
      status: "claimed",
      claimedBy:
        i === 0 ? ADMIN_USER_ID : i === 1 ? SABRI_USER_ID : AMINE_USER_ID,
      claimedAt: new Date(Date.now() - (i + 20) * 86400000),
      price: 399.99,
      rarity: i === 0 ? "legendary" : "rare",
      imageUrl: {
        url: `https://images.unsplash.com/photo-1531259683007-016a7b628fc3?auto=format&fit=crop&w=400&h=300&q=80`,
        alt: `Wall Fragment ${i + 1}`,
        publicId: `aot-fragment-${i + 1}`,
      },
      features: [
        // Now as array of strings
        "Hidden coordinates",
        "Titan symbols",
        "Survey Corps marking",
        "Numbered certificate",
      ],
      clues: {
        revealed: 5,
        total: 5,
        list: [],
      },
      estimatedDelivery: "Delivered", // Now string, not date
      metadata: {
        viewCount: Math.floor(Math.random() * 200) + 100,
      },
    });
  }

  // Demon Slayer fragments (9 fragments) - none claimed
  for (let i = 0; i < 9; i++) {
    fragments.push({
      chronicle: demonSlayerChronicle._id,
      number: i + 1,
      name: `Breath Fragment #${i + 1}`,
      description: `Contains the essence of a breathing technique`,
      status: "available",
      price: 279.99,
      rarity: i === 0 ? "legendary" : i < 3 ? "rare" : "common",
      imageUrl: {
        url: `https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=400&h=300&q=80`,
        alt: `Breath Fragment ${i + 1}`,
        publicId: `demon-slayer-fragment-${i + 1}`,
      },
      features: [
        // Now as array of strings
        "Hidden breathing patterns",
        "Demon slayer marking",
        "Nichirin color",
        "Numbered certificate",
      ],
      clues: {
        revealed: 0,
        total: 5,
        list: [],
      },
      estimatedDelivery: "8-10 weeks", // Now string, not date
      isFeatured: i === 2,
      metadata: {
        viewCount: Math.floor(Math.random() * 30) + 5,
      },
    });
  }

  // Dragon Ball fragments (7 fragments) - all claimed
  for (let i = 0; i < 7; i++) {
    fragments.push({
      chronicle: dbChronicle._id,
      number: i + 1,
      name: `Dragon Ball ${i + 1} Star`,
      description: `Contains the power of the ${i + 1} star dragon ball`,
      status: "claimed",
      claimedBy: i % 2 === 0 ? ADMIN_USER_ID : OUSSAMA_USER_ID,
      claimedAt: new Date(Date.now() - (i + 30) * 86400000),
      price: 249.99,
      rarity: i === 4 ? "legendary" : "rare",
      imageUrl: {
        url: `https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=400&h=300&q=80`,
        alt: `Dragon Ball ${i + 1} Star`,
        publicId: `db-fragment-${i + 1}`,
      },
      features: [
        // Now as array of strings
        "Glowing effect",
        "Dragon symbol",
        "Star marking",
        "Numbered certificate",
      ],
      clues: {
        revealed: 5,
        total: 5,
        list: [],
      },
      estimatedDelivery: "Delivered", // Now string, not date
      metadata: {
        viewCount: Math.floor(Math.random() * 300) + 200,
      },
    });
  }

  // Cyber fragments (15 fragments) - 2 claimed, 13 available
  for (let i = 0; i < 15; i++) {
    const isClaimed = i < 2; // First 2 are claimed
    fragments.push({
      chronicle: cyberChronicle._id,
      number: i + 1,
      name: `Neural Link #${String.fromCharCode(65 + i)}`,
      description: `Contains encrypted neural data and digital signatures`,
      status: isClaimed ? "claimed" : "available",
      claimedBy: isClaimed ? (i === 0 ? ADMIN_USER_ID : AMINE_USER_ID) : null,
      claimedAt: isClaimed ? new Date(Date.now() - i * 86400000) : null,
      price: 449.99 + i * 25,
      rarity: i === 0 ? "legendary" : i < 5 ? "rare" : "common",
      imageUrl: {
        url: `https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?auto=format&fit=crop&w=400&h=300&q=80`,
        alt: `Neural Link ${String.fromCharCode(65 + i)}`,
        publicId: `cyber-fragment-${i + 1}`,
      },
      features: [
        // Now as array of strings
        "QR code",
        "Neural pattern",
        "Digital signature",
        "Holographic element",
      ],
      clues: {
        revealed: isClaimed ? 1 : 0,
        total: 5,
        list: [],
      },
      estimatedDelivery: "10-12 weeks", // Now string, not date
      isFeatured: i === 7,
      metadata: {
        viewCount: Math.floor(Math.random() * 50) + 10,
      },
    });
  }

  const createdFragments = await Fragment.insertMany(fragments);
  console.log(`✅ Seeded ${createdFragments.length} fragments`);
  return createdFragments;
};

// ... (rest of the seed file remains the same)

// Seed Claims - UPDATED VERSION with correct size values
const seedClaims = async (fragments) => {
  console.log("📦 Seeding claims...");

  const claimedFragments = fragments.filter((f) => f.status === "claimed");
  const claims = [];

  // Map of size abbreviations to schema enum values
  const sizeMap = {
    S: "small",
    M: "medium",
    L: "large",
    XL: "large", // Map XL to large since XL isn't in enum
    custom: "custom",
  };

  for (let i = 0; i < claimedFragments.length; i++) {
    const fragment = claimedFragments[i];
    const user = fragment.claimedBy;

    // Find user details
    let userData;
    if (user.toString() === ADMIN_USER_ID) {
      userData = {
        fullName: "Wissem SAADLI",
        email: "wissem.saadli@sesame.com.tn",
        phone: "+216 12345678",
      };
    } else if (user.toString() === SABRI_USER_ID) {
      userData = {
        fullName: "sabri slg",
        email: "sabrislougui@gmail.com",
        phone: "+216 23456789",
      };
    } else if (user.toString() === OUSSAMA_USER_ID) {
      userData = {
        fullName: "oussama gharsalli",
        email: "oussamamessi1899@gmail.com",
        phone: "+216 34567890",
      };
    } else {
      userData = {
        fullName: "Amine Allagui",
        email: "amynallagui1@gmail.com",
        phone: "+216 45678901",
      };
    }

    // Generate random size from allowed enum values
    const sizes = ["small", "medium", "large", "custom"];
    const randomSize = sizes[Math.floor(Math.random() * sizes.length)];

    claims.push({
      claimId: `CLM-${String(new Date().getFullYear()).slice(2)}${String(
        i + 1
      ).padStart(6, "0")}`,
      fragment: fragment._id,
      user: user,
      userData: {
        fullName: userData.fullName,
        email: userData.email,
        phone: userData.phone,
        shippingAddress: {
          address: "123 Main Street",
          city: "Tunis",
          state: "Tunis",
          postalCode: "1000",
          country: "TN",
        },
        size: randomSize, // Now using correct enum values: small, medium, large, custom
        customization: i % 3 === 0 ? "Add special inscription" : "",
        acceptTerms: true,
        acceptUpdates: true,
      },
      payment: {
        method: ["stripe", "paypal"][Math.floor(Math.random() * 2)],
        transactionId: `txn_${Math.random().toString(36).substring(2, 15)}`,
        amount:
          Math.round((fragment.price + fragment.price * 0.1 + 25) * 100) / 100, // price + tax + shipping, rounded to 2 decimals
        currency: "USD",
        status: "completed",
        paidAt: new Date(Date.now() - i * 86400000),
      },
      status: getClaimStatus(fragment, i), // Helper function to determine status
      trackingInfo: getTrackingInfo(fragment, i), // Helper function for tracking
    });
  }

  const createdClaims = await Claim.insertMany(claims);
  console.log(`✅ Seeded ${createdClaims.length} claims`);

  // Update keeper profiles with claim stats
  for (const claim of claims) {
    const keeperProfile = await KeeperProfile.findOne({ user: claim.user });
    if (keeperProfile) {
      keeperProfile.stats.fragmentsClaimed += 1;
      keeperProfile.stats.totalSpent += claim.payment.amount;
      keeperProfile.stats.claimsCount += 1;

      // Get unique chronicles
      const fragment = await Fragment.findById(claim.fragment);
      if (fragment && fragment.chronicle) {
        const chronicleId = fragment.chronicle;

        const userClaims = await Claim.find({
          user: claim.user,
          status: { $in: ["confirmed", "processing", "shipped", "delivered"] },
        }).populate("fragment");

        const uniqueChronicles = new Set();
        userClaims.forEach((c) => {
          if (c.fragment && c.fragment.chronicle) {
            uniqueChronicles.add(c.fragment.chronicle.toString());
          }
        });

        keeperProfile.stats.uniqueChronicles = uniqueChronicles.size;
      }
      await keeperProfile.save();
    }
  }

  return createdClaims;
};

// Helper function to determine claim status based on fragment
const getClaimStatus = (fragment, index) => {
  // If fragment is from a solved chronicle, mark as delivered
  if (fragment.chronicle.toString().includes("solved")) {
    return "delivered";
  }

  // Otherwise distribute statuses
  const statuses = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
  ];
  return statuses[index % statuses.length];
};

// Helper function to generate tracking info
const getTrackingInfo = (fragment, index) => {
  // Only add tracking info for shipped or delivered items
  if (index % 4 === 3 || index % 4 === 0) {
    // shipped or delivered
    return {
      carrier: ["UPS", "FedEx", "DHL"][index % 3],
      trackingNumber: `TRK${Math.random()
        .toString(36)
        .substring(2, 12)
        .toUpperCase()}`,
      estimatedDelivery: new Date(Date.now() + 30 * 86400000),
      shippedAt: new Date(Date.now() - index * 86400000),
    };
  }
  return {}; // Empty tracking info for pending/confirmed
};

// Seed Waitlist
const seedWaitlist = async (chronicles, users) => {
  console.log("⏳ Seeding waitlist...");

  const activeChronicles = chronicles.filter(
    (c) => c.status === "available" && c.waitlist && c.waitlist.enabled
  );

  const waitlistEntries = [];

  // Add some users to waitlists
  for (const chronicle of activeChronicles) {
    // Add admin to some waitlists
    if (Math.random() > 0.5) {
      waitlistEntries.push({
        chronicle: chronicle._id,
        user: ADMIN_USER_ID,
        email: "wissem.saadli@sesame.com.tn",
        position: waitlistEntries.length + 1,
        preferences: {
          notifyOnAvailable: true,
          notifyOnNewChronicle: true,
          notificationMethods: {
            email: true,
            sms: false,
          },
        },
        status: "active",
        source: "organic",
      });
    }

    // Add sabri to some waitlists
    if (Math.random() > 0.6) {
      waitlistEntries.push({
        chronicle: chronicle._id,
        user: SABRI_USER_ID,
        email: "sabrislougui@gmail.com",
        position: waitlistEntries.length + 1,
        preferences: {
          notifyOnAvailable: true,
          notifyOnNewChronicle: false,
          notificationMethods: {
            email: true,
            sms: false,
          },
        },
        status: "active",
        source: "organic",
      });
    }

    // Add oussama to some waitlists
    if (Math.random() > 0.7) {
      waitlistEntries.push({
        chronicle: chronicle._id,
        user: OUSSAMA_USER_ID,
        email: "oussamamessi1899@gmail.com",
        position: waitlistEntries.length + 1,
        preferences: {
          notifyOnAvailable: true,
          notifyOnNewChronicle: true,
          notificationMethods: {
            email: true,
            sms: true,
          },
        },
        status: "active",
        source: "referral",
      });
    }

    // Add amine to some waitlists
    if (Math.random() > 0.8) {
      waitlistEntries.push({
        chronicle: chronicle._id,
        user: AMINE_USER_ID,
        email: "amynallagui1@gmail.com",
        position: waitlistEntries.length + 1,
        preferences: {
          notifyOnAvailable: true,
          notifyOnNewChronicle: true,
          notificationMethods: {
            email: true,
            sms: false,
          },
        },
        status: "active",
        source: "campaign",
      });
    }

    // Add some anonymous entries
    for (let i = 0; i < 3; i++) {
      waitlistEntries.push({
        chronicle: chronicle._id,
        email: `keeper${Math.floor(Math.random() * 1000)}@example.com`,
        position: waitlistEntries.length + 1,
        preferences: {
          notifyOnAvailable: true,
          notifyOnNewChronicle: Math.random() > 0.5,
          notificationMethods: {
            email: true,
            sms: false,
          },
        },
        status: "active",
        source: "organic",
        metadata: {
          userAgent: "Mozilla/5.0...",
          ipAddress: "192.168.1." + Math.floor(Math.random() * 255),
        },
      });
    }
  }

  const createdWaitlist = await Waitlist.insertMany(waitlistEntries);
  console.log(`✅ Seeded ${createdWaitlist.length} waitlist entries`);

  // Update chronicle waitlist counts
  for (const chronicle of activeChronicles) {
    const count = await Waitlist.countDocuments({
      chronicle: chronicle._id,
      status: "active",
    });
    chronicle.waitlist.currentCount = count;
    await chronicle.save();
  }

  // Update keeper profiles with waitlist stats
  const userWaitlistCounts = {};
  waitlistEntries.forEach((entry) => {
    if (entry.user) {
      userWaitlistCounts[entry.user] =
        (userWaitlistCounts[entry.user] || 0) + 1;
    }
  });

  for (const [userId, count] of Object.entries(userWaitlistCounts)) {
    const keeperProfile = await KeeperProfile.findOne({ user: userId });
    if (keeperProfile) {
      keeperProfile.stats.waitlistEntries += count;
      await keeperProfile.save();
    }
  }
};

// Update keeper profiles with fragment stats
const updateKeeperStats = async () => {
  console.log("📊 Updating keeper stats...");

  const users = [ADMIN_USER_ID, SABRI_USER_ID, OUSSAMA_USER_ID, AMINE_USER_ID];

  for (const userId of users) {
    const keeperProfile = await KeeperProfile.findOne({ user: userId });
    if (!keeperProfile) continue;

    // Get all claims for this user
    const claims = await Claim.find({
      user: userId,
      status: { $in: ["confirmed", "processing", "shipped", "delivered"] },
    });

    const fragments = await Fragment.find({ claimedBy: userId });

    // Get unique chronicles
    const fragmentIds = fragments.map((f) => f._id);
    const chronicleIds = new Set();
    fragments.forEach((f) => {
      if (f.chronicle) chronicleIds.add(f.chronicle.toString());
    });

    // Update stats
    keeperProfile.stats.fragmentsClaimed = fragments.length;
    keeperProfile.stats.claimsCount = claims.length;
    keeperProfile.stats.uniqueChronicles = chronicleIds.size;
    keeperProfile.stats.totalSpent = claims.reduce(
      (sum, c) => sum + (c.payment?.amount || 0),
      0
    );

    // Calculate reputation based on activity
    const baseRep = 50;
    const fragmentBonus = Math.min(20, fragments.length * 2);
    const chronicleBonus = Math.min(15, chronicleIds.size * 3);
    const spentBonus = Math.min(
      15,
      Math.floor(keeperProfile.stats.totalSpent / 500)
    );

    keeperProfile.reputation = Math.min(
      100,
      baseRep + fragmentBonus + chronicleBonus + spentBonus
    );

    await keeperProfile.save();
  }

  console.log("✅ Keeper stats updated");
};

// Main seed function
const seedDatabase = async () => {
  try {
    await connectDB();
    await clearData();

    await createKeeperProfiles();

    const enigmas = await seedEnigmas();
    const chronicles = await seedChronicles(enigmas);
    const fragments = await seedFragments(chronicles);

    await seedClaims(fragments);
    await seedWaitlist(chronicles, [
      ADMIN_USER_ID,
      SABRI_USER_ID,
      OUSSAMA_USER_ID,
      AMINE_USER_ID,
    ]);

    await updateKeeperStats();

    console.log("\n🎉 Database seeding completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`   - ${enigmas.length} Enigmas`);
    console.log(`   - ${chronicles.length} Chronicles`);
    console.log(`   - ${fragments.length} Fragments`);
    console.log(`   - ${await Claim.countDocuments()} Claims`);
    console.log(`   - ${await Waitlist.countDocuments()} Waitlist entries`);
    console.log(`   - ${await KeeperProfile.countDocuments()} Keeper profiles`);
  } catch (error) {
    console.error("❌ Seeding error:", error);
  } finally {
    await mongoose.connection.close();
    console.log("📡 Database connection closed");
  }
};

// Run the seed function
seedDatabase();
