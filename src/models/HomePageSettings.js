// models/HomePageSettings.js
const mongoose = require("mongoose");

const homePageSettingsSchema = new mongoose.Schema(
  {
    // Hero Section
    hero: {
      title: {
        type: String,
        default: "Elevate Your Style Game",
        trim: true,
      },
      subtitle: {
        type: String,
        default:
          "Discover premium clothing that combines comfort, style, and sustainability. Shop the latest trends at unbeatable prices.",
        trim: true,
      },
      badge: {
        type: String,
        default: "New Summer Collection 2024",
        trim: true,
      },
      image: {
        url: {
          type: String,
          default: "",
        },
        publicId: {
          type: String,
          default: "",
        },
        alt: {
          type: String,
          default: "Fashion Model",
        },
      },
      stats: {
        customers: {
          value: {
            type: String,
            default: "10K+",
          },
          label: {
            type: String,
            default: "Happy Customers",
          },
        },
        products: {
          value: {
            type: String,
            default: "500+",
          },
          label: {
            type: String,
            default: "Premium Products",
          },
        },
        support: {
          value: {
            type: String,
            default: "24/7",
          },
          label: {
            type: String,
            default: "Customer Support",
          },
        },
      },
      buttons: {
        primary: {
          text: {
            type: String,
            default: "Shop Now",
          },
          link: {
            type: String,
            default: "/shop",
          },
        },
        secondary: {
          text: {
            type: String,
            default: "New Arrivals",
          },
          link: {
            type: String,
            default: "/shop?category=new",
          },
        },
      },
    },

    // Puzzle Mysteries Section
    mysteries: {
      enabled: {
        type: Boolean,
        default: true,
      },
      badge: {
        type: String,
        default: "✨ Exclusive Experience",
      },
      title: {
        type: String,
        default: "Join Our Puzzle Mysteries",
        trim: true,
      },
      subtitle: {
        type: String,
        default:
          "Become part of an exclusive community solving epic fashion mysteries. Claim unique fragments, collaborate with keepers, and earn legendary rewards.",
        trim: true,
      },
      ctaButton: {
        text: {
          type: String,
          default: "🧩 Explore All Mysteries",
        },
        link: {
          type: String,
          default: "/mysteries",
        },
      },
      featuredMystery: {
        title: {
          type: String,
          default: "Anime Chronicles",
          trim: true,
        },
        description: {
          type: String,
          default:
            "Unravel hidden truths behind legendary anime worlds. Claim fragments, solve mysteries, and earn exclusive rewards.",
          trim: true,
        },
        image: {
          url: {
            type: String,
            default: "",
          },
          publicId: {
            type: String,
            default: "",
          },
          alt: {
            type: String,
            default: "Anime Chronicles Mystery",
          },
        },
        stats: {
          fragments: {
            type: Number,
            default: 9,
          },
          claimed: {
            type: Number,
            default: 3,
          },
          available: {
            type: Number,
            default: 6,
          },
        },
        badge: {
          type: String,
          default: "Active Mystery",
        },
        badgeColor: {
          type: String,
          default: "bg-primary-100 text-primary-700",
        },
        link: {
          type: String,
          default: "/mysteries",
        },
      },
      steps: [
        {
          icon: {
            type: String,
            default: "🔍",
          },
          title: {
            type: String,
            default: "Discover Mysteries",
            trim: true,
          },
          description: {
            type: String,
            default: "Browse exclusive puzzle collections",
            trim: true,
          },
          detail: {
            type: String,
            default:
              "Each mystery contains unique fragments that form part of a larger story. Explore themes like Anime Chronicles, Mythology Enigmas, and more.",
            trim: true,
          },
          bgColor: {
            type: String,
            default: "from-primary-100 to-primary-200",
          },
        },
        {
          icon: {
            type: String,
            default: "👥",
          },
          title: {
            type: String,
            default: "Claim & Collaborate",
            trim: true,
          },
          description: {
            type: String,
            default: "Join keepers solving puzzles together",
            trim: true,
          },
          detail: {
            type: String,
            default:
              "Claim unique fragments, connect with other keepers, and work together to unravel mysteries. Each fragment is globally unique to its owner.",
            trim: true,
          },
          bgColor: {
            type: String,
            default: "from-emerald-100 to-emerald-200",
          },
        },
        {
          icon: {
            type: String,
            default: "✨",
          },
          title: {
            type: String,
            default: "Earn Rewards",
            trim: true,
          },
          description: {
            type: String,
            default: "Unlock exclusive prizes and recognition",
            trim: true,
          },
          detail: {
            type: String,
            default:
              "Solve mysteries to earn limited edition artifacts, digital content, special recognition, and early access to future releases.",
            trim: true,
          },
          bgColor: {
            type: String,
            default: "from-amber-100 to-amber-200",
          },
        },
      ],
    },

    // Features Section
    features: [
      {
        icon: {
          type: String,
          default: "Truck",
        },
        title: {
          type: String,
          default: "Free Shipping",
          trim: true,
        },
        description: {
          type: String,
          default: "Free delivery on orders over 300 TND",
          trim: true,
        },
        bgColor: {
          type: String,
          default: "from-primary-100 to-primary-200",
        },
        textColor: {
          type: String,
          default: "text-primary-600",
        },
        enabled: {
          type: Boolean,
          default: true,
        },
      },
      {
        icon: {
          type: String,
          default: "Shield",
        },
        title: {
          type: String,
          default: "Secure Payment",
          trim: true,
        },
        description: {
          type: String,
          default: "100% secure payment processing",
          trim: true,
        },
        bgColor: {
          type: String,
          default: "from-emerald-100 to-emerald-200",
        },
        textColor: {
          type: String,
          default: "text-emerald-600",
        },
        enabled: {
          type: Boolean,
          default: true,
        },
      },
      {
        icon: {
          type: String,
          default: "Star",
        },
        title: {
          type: String,
          default: "Premium Quality",
          trim: true,
        },
        description: {
          type: String,
          default: "High-quality materials & craftsmanship",
          trim: true,
        },
        bgColor: {
          type: String,
          default: "from-amber-100 to-amber-200",
        },
        textColor: {
          type: String,
          default: "text-amber-600",
        },
        enabled: {
          type: Boolean,
          default: true,
        },
      },
    ],

    // CTA Section
    cta: {
      title: {
        type: String,
        default: "Ready to Transform Your Wardrobe?",
        trim: true,
      },
      subtitle: {
        type: String,
        default:
          "Join thousands of satisfied customers who have elevated their style with DAR ENNAR",
        trim: true,
      },
      buttons: {
        primary: {
          text: {
            type: String,
            default: "Start Shopping",
          },
          link: {
            type: String,
            default: "/shop",
          },
          variant: {
            type: String,
            default: "secondary",
          },
        },
        secondary: {
          text: {
            type: String,
            default: "Create Account",
          },
          link: {
            type: String,
            default: "/register",
          },
          variant: {
            type: String,
            default: "outline",
          },
        },
      },
      bgGradient: {
        type: String,
        default: "from-primary-600 to-black",
      },
    },

    // SEO
    seo: {
      title: {
        type: String,
        default: "PUZZLE - Where Fashion Meets Mystery",
        trim: true,
      },
      description: {
        type: String,
        default:
          "Discover premium clothing with a twist. PUZZLE combines fashion with interactive mysteries and collectible fragments.",
        trim: true,
      },
      keywords: [
        {
          type: String,
        },
      ],
    },

    // Last updated by
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one settings document exists
homePageSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model("HomePageSettings", homePageSettingsSchema);
