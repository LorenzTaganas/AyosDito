import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { config } from '../src/config';
import { recalcProviderStats } from '../src/services/providerStats';

const prisma = new PrismaClient();

const CATEGORY_SEED = [
  {
    name: 'Laptop & Computer Repair',
    slug: 'laptop-computer-repair',
    icon: 'laptop',
    description: 'Diagnostics, repairs, upgrades, and home service for laptops and desktop computers.',
    sortOrder: 10,
  },
  {
    name: 'Mobile Phone Repair',
    slug: 'mobile-phone-repair',
    icon: 'smartphone',
    description: 'Screen replacement, battery issues, charging ports, and software troubleshooting.',
    sortOrder: 20,
  },
  {
    name: 'Appliance Repair',
    slug: 'appliance-repair',
    icon: 'washing-machine',
    description: 'Repair and maintenance for refrigerators, washing machines, fans, and small appliances.',
    sortOrder: 30,
  },
  {
    name: 'Electrical Services',
    slug: 'electrical-services',
    icon: 'zap',
    description: 'Outlet, wiring, lighting, and electrical troubleshooting for homes and small businesses.',
    sortOrder: 40,
  },
  {
    name: 'Plumbing Services',
    slug: 'plumbing-services',
    icon: 'droplets',
    description: 'Leaks, clogs, faucets, water lines, and general plumbing repairs.',
    sortOrder: 50,
  },
  {
    name: 'Internet & Wi-Fi',
    slug: 'internet-wifi',
    icon: 'wifi',
    description: 'Wi-Fi setup, network troubleshooting, cable work, and internet configuration.',
    sortOrder: 60,
  },
  {
    name: 'Aircon Services',
    slug: 'aircon-services',
    icon: 'wind',
    description: 'Cleaning, installation, repair, and maintenance for air-conditioning units.',
    sortOrder: 70,
  },
  {
    name: 'General Maintenance',
    slug: 'general-maintenance',
    icon: 'wrench',
    description: 'Small repairs, installation work, and general handyman services.',
    sortOrder: 80,
  },
];

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function seedAdmin() {
  if (config.isProduction && !process.env.ADMIN_PASSWORD) {
    throw new Error('Set ADMIN_PASSWORD in the environment before seeding an administrator in production.');
  }

  const existing = await prisma.user.findUnique({ where: { email: config.adminSeed.email } });
  if (existing) {
    if (existing.role !== 'ADMIN') {
      console.warn(`[seed] ${existing.email} exists but is not an admin. Review the account manually.`);
    }
    console.log(`[seed] Admin account exists, leaving it unchanged: ${existing.email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(config.adminSeed.password, config.bcryptRounds);
  await prisma.user.create({
    data: {
      fullName: config.adminSeed.name,
      email: config.adminSeed.email,
      passwordHash,
      role: 'ADMIN',
      emailVerifiedAt: new Date(),
      isDemo: false,
    },
  });
  console.log(`[seed] Created administrator: ${config.adminSeed.email}`);
  if (!config.isProduction) {
    console.log(`[seed] Local admin password comes from ADMIN_PASSWORD in server/.env.`);
  }
}

async function seedCatalog() {
  for (const category of CATEGORY_SEED) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: {
        ...category,
        isActive: true,
      },
    });
  }
  console.log(`[seed] Service categories ready (${CATEGORY_SEED.length}).`);

  const centralLuzon =
    (await prisma.location.findFirst({
      where: { name: 'Central Luzon', locationType: 'REGION', parentLocationId: null },
    })) ??
    (await prisma.location.create({
      data: { name: 'Central Luzon', locationType: 'REGION', isActive: true },
    }));

  const bulacan =
    (await prisma.location.findFirst({
      where: { name: 'Bulacan', locationType: 'PROVINCE', parentLocationId: centralLuzon.id },
    })) ??
    (await prisma.location.create({
      data: {
        name: 'Bulacan',
        locationType: 'PROVINCE',
        parentLocationId: centralLuzon.id,
        isActive: true,
      },
    }));

  async function ensurePlace(name: string, locationType: string, parentId: string) {
    const existing = await prisma.location.findFirst({
      where: { name, locationType, parentLocationId: parentId },
    });
    if (existing) return existing;
    return prisma.location.create({
      data: { name, locationType, parentLocationId: parentId, isActive: true },
    });
  }

  const malolos = await ensurePlace('City of Malolos', 'CITY', bulacan.id);
  const meycauayan = await ensurePlace('Meycauayan', 'CITY', bulacan.id);
  const marilao = await ensurePlace('Marilao', 'CITY', bulacan.id);
  const bocaue = await ensurePlace('Bocaue', 'CITY', bulacan.id);
  const sanJoseDelMonte = await ensurePlace('San Jose del Monte', 'CITY', bulacan.id);

  const guinhawa = await ensurePlace('Guinhawa', 'BARANGAY', malolos.id);
  const santoNino = await ensurePlace('Santo Niño', 'BARANGAY', malolos.id);
  const sumapangMatanda = await ensurePlace('Sumapang Matanda', 'BARANGAY', malolos.id);
  const camalig = await ensurePlace('Camalig', 'BARANGAY', meycauayan.id);
  const malhacan = await ensurePlace('Malhacan', 'BARANGAY', meycauayan.id);

  console.log('[seed] Central Luzon / Bulacan service locations ready.');

  return {
    malolos,
    meycauayan,
    marilao,
    bocaue,
    sanJoseDelMonte,
    guinhawa,
    santoNino,
    sumapangMatanda,
    camalig,
    malhacan,
  };
}

async function ensureUser(data: {
  email: string;
  fullName: string;
  passwordHash: string;
  role: 'CUSTOMER' | 'PROVIDER';
  isDemo: boolean;
  preferredLocationId?: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) return existing;

  return prisma.user.create({
    data: {
      email: data.email,
      fullName: data.fullName,
      passwordHash: data.passwordHash,
      role: data.role,
      emailVerifiedAt: new Date(),
      isDemo: data.isDemo,
      ...(data.role === 'CUSTOMER'
        ? {
            customerProfile: {
              create: { preferredLocationId: data.preferredLocationId ?? null },
            },
          }
        : {}),
    },
  });
}

interface ProviderSeed {
  email: string;
  ownerName: string;
  businessName: string;
  description: string;
  yearsOfExperience: number;
  approvalStatus: 'APPROVED' | 'PENDING';
  areas: string[];
  listings: {
    categorySlug: string;
    title: string;
    description: string;
    startingPrice: number;
    diagnosticFee?: number;
    priceType?: 'STARTING_FROM' | 'ESTIMATE' | 'FIXED';
    requiresInspection?: boolean;
  }[];
}

async function ensureProvider(
  seed: ProviderSeed,
  passwordHash: string,
  categoryIds: Map<string, string>,
): Promise<{ userId: string; providerId: string }> {
  const user = await ensureUser({
    email: seed.email,
    fullName: seed.ownerName,
    passwordHash,
    role: 'PROVIDER',
    isDemo: true,
  });

  const existingProfile = await prisma.providerProfile.findUnique({ where: { userId: user.id } });
  const profile =
    existingProfile ??
    (await prisma.providerProfile.create({
      data: {
        userId: user.id,
        businessName: seed.businessName,
        description: seed.description,
        yearsOfExperience: seed.yearsOfExperience,
        approvalStatus: seed.approvalStatus,
        approvedAt: seed.approvalStatus === 'APPROVED' ? daysAgo(60) : null,
        isDemo: true,
      },
    }));

  for (const locationId of seed.areas) {
    await prisma.providerServiceArea.upsert({
      where: { providerId_locationId: { providerId: profile.id, locationId } },
      update: {},
      create: { providerId: profile.id, locationId },
    });
  }

  for (const listing of seed.listings) {
    const categoryId = categoryIds.get(listing.categorySlug);
    if (!categoryId) throw new Error(`Missing category seed: ${listing.categorySlug}`);
    const exists = await prisma.serviceListing.findFirst({
      where: { providerId: profile.id, categoryId, title: listing.title },
    });
    if (!exists) {
      await prisma.serviceListing.create({
        data: {
          providerId: profile.id,
          categoryId,
          title: listing.title,
          description: listing.description,
          startingPrice: listing.startingPrice,
          diagnosticFee: listing.diagnosticFee ?? null,
          priceType: listing.priceType ?? 'STARTING_FROM',
          requiresInspection: listing.requiresInspection ?? false,
          isActive: true,
        },
      });
    }
  }

  await recalcProviderStats(profile.id);
  return { userId: user.id, providerId: profile.id };
}

async function ensureFavorite(customerId: string, providerId: string) {
  await prisma.favorite.upsert({
    where: { customerId_providerId: { customerId, providerId } },
    update: {},
    create: { customerId, providerId },
  });
}

async function ensureDemoRequest(options: {
  customerId: string;
  categoryId: string;
  locationId: string;
  title: string;
  problemDescription: string;
  status: string;
  daysOld: number;
  targetProviderId?: string | null;
  assignedProviderId?: string | null;
  completedAt?: Date | null;
  quotes?: {
    providerId: string;
    proposedPrice: number;
    priceNotes: string;
    estimatedDuration: string;
    status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
    daysOld: number;
  }[];
  review?: {
    providerId: string;
    rating: number;
    comment: string;
    daysOld: number;
    providerResponse?: string;
  };
}) {
  const existing = await prisma.serviceRequest.findFirst({
    where: { customerId: options.customerId, title: options.title },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.serviceRequest.create({
    data: {
      customerId: options.customerId,
      categoryId: options.categoryId,
      locationId: options.locationId,
      title: options.title,
      problemDescription: options.problemDescription,
      status: options.status,
      targetProviderId: options.targetProviderId ?? null,
      assignedProviderId: options.assignedProviderId ?? null,
      completedAt: options.completedAt ?? null,
      createdAt: daysAgo(options.daysOld),
    },
  });

  for (const quote of options.quotes ?? []) {
    await prisma.quote.create({
      data: {
        serviceRequestId: created.id,
        providerId: quote.providerId,
        proposedPrice: quote.proposedPrice,
        priceNotes: quote.priceNotes,
        estimatedDuration: quote.estimatedDuration,
        status: quote.status,
        createdAt: daysAgo(quote.daysOld),
      },
    });
  }

  if (options.review) {
    await prisma.review.create({
      data: {
        serviceRequestId: created.id,
        customerId: options.customerId,
        providerId: options.review.providerId,
        rating: options.review.rating,
        comment: options.review.comment,
        providerResponse: options.review.providerResponse ?? null,
        providerRespondedAt: options.review.providerResponse ? daysAgo(options.review.daysOld - 1) : null,
        createdAt: daysAgo(options.review.daysOld),
      },
    });
    await recalcProviderStats(options.review.providerId);
  }

  return created.id;
}

async function seedDemo(catalog: Awaited<ReturnType<typeof seedCatalog>>, categoryIds: Map<string, string>) {
  const demoPasswordHash = await bcrypt.hash(config.demoPassword, config.bcryptRounds);

  const maria = await ensureUser({
    email: 'customer.maria@ayosdito.test',
    fullName: 'Maria Santos',
    passwordHash: demoPasswordHash,
    role: 'CUSTOMER',
    isDemo: true,
    preferredLocationId: catalog.malolos.id,
  });
  const carlo = await ensureUser({
    email: 'customer.carlo@ayosdito.test',
    fullName: 'Carlo Reyes',
    passwordHash: demoPasswordHash,
    role: 'CUSTOMER',
    isDemo: true,
    preferredLocationId: catalog.meycauayan.id,
  });
  const ana = await ensureUser({
    email: 'customer.ana@ayosdito.test',
    fullName: 'Ana Dela Cruz',
    passwordHash: demoPasswordHash,
    role: 'CUSTOMER',
    isDemo: true,
    preferredLocationId: catalog.malolos.id,
  });

  const laptopCare = await ensureProvider(
    {
      email: 'provider.laptopcare@ayosdito.test',
      ownerName: 'Jose Ramirez',
      businessName: 'Malolos Laptop Care',
      description:
        'Home-service laptop and desktop repair around Malolos. We explain the diagnosis before any part is replaced and return the old parts to you.',
      yearsOfExperience: 6,
      approvalStatus: 'APPROVED',
      areas: [catalog.malolos.id, catalog.guinhawa.id, catalog.santoNino.id],
      listings: [
        {
          categorySlug: 'laptop-computer-repair',
          title: 'Laptop diagnostics and repair',
          description:
            'Initial check includes storage health, memory, battery, and overheating checks. Replacement parts are quoted separately before work continues.',
          startingPrice: 35000,
          diagnosticFee: 20000,
          priceType: 'STARTING_FROM',
          requiresInspection: true,
        },
        {
          categorySlug: 'laptop-computer-repair',
          title: 'SSD upgrade and data transfer',
          description: 'SSD upgrade with operating system transfer. Final price depends on the capacity you choose.',
          startingPrice: 180000,
          priceType: 'ESTIMATE',
          requiresInspection: true,
        },
        {
          categorySlug: 'internet-wifi',
          title: 'Home Wi-Fi setup and checking',
          description: 'Router setup, Wi-Fi placement check, and basic configuration for home networks.',
          startingPrice: 50000,
          priceType: 'STARTING_FROM',
        },
      ],
    },
    demoPasswordHash,
    categoryIds,
  );

  const homeFix = await ensureProvider(
    {
      email: 'provider.homefix@ayosdito.test',
      ownerName: 'Liza Fernandez',
      businessName: 'Meycauayan HomeFix',
      description:
        'Plumbing, electrical, and appliance troubleshooting for households and small shops in Meycauayan. We give a scope and price estimate before starting.',
      yearsOfExperience: 9,
      approvalStatus: 'APPROVED',
      areas: [catalog.meycauayan.id, catalog.camalig.id, catalog.malhacan.id, catalog.malolos.id],
      listings: [
        {
          categorySlug: 'plumbing-services',
          title: 'Leak and clog repair',
          description: 'Faucet, sink, and pipe leak checks. Repair price depends on parts and access to the pipe.',
          startingPrice: 50000,
          diagnosticFee: 30000,
          priceType: 'STARTING_FROM',
          requiresInspection: true,
        },
        {
          categorySlug: 'electrical-services',
          title: 'Home electrical troubleshooting',
          description: 'Outlet, switch, and lighting troubleshooting. Does not cover major rewiring.',
          startingPrice: 45000,
          priceType: 'STARTING_FROM',
          requiresInspection: true,
        },
        {
          categorySlug: 'appliance-repair',
          title: 'Small appliance check and repair',
          description: 'Electric fan, rice cooker, and similar small appliances. Replacement parts quoted separately.',
          startingPrice: 40000,
          priceType: 'STARTING_FROM',
        },
      ],
    },
    demoPasswordHash,
    categoryIds,
  );

  const coolAir = await ensureProvider(
    {
      email: 'provider.coolair@ayosdito.test',
      ownerName: 'Benjie Cruz',
      businessName: 'Bulacan Cool Air Services',
      description:
        'Aircon cleaning and maintenance for window and split-type units. We check drainage and cooling after cleaning.',
      yearsOfExperience: 5,
      approvalStatus: 'APPROVED',
      areas: [catalog.malolos.id, catalog.marilao.id, catalog.bocaue.id],
      listings: [
        {
          categorySlug: 'aircon-services',
          title: 'Split-type aircon cleaning',
          description:
            'General cleaning of filters, coils, and drainage. Price is per unit; additional charges may apply for very dirty or hard-to-access units.',
          startingPrice: 60000,
          priceType: 'STARTING_FROM',
          requiresInspection: true,
        },
        {
          categorySlug: 'aircon-services',
          title: 'Window-type aircon cleaning',
          description: 'Cleaning for standard window-type units. Price is per unit.',
          startingPrice: 45000,
          priceType: 'FIXED',
        },
      ],
    },
    demoPasswordHash,
    categoryIds,
  );

  const homeWorks = await ensureProvider(
    {
      email: 'provider.homeworks@ayosdito.test',
      ownerName: 'Rina Lopez',
      businessName: 'Bulacan Home Works',
      description:
        'General household repairs and installations around Malolos and Meycauayan. We schedule a visit to inspect before confirming the final price.',
      yearsOfExperience: 4,
      approvalStatus: 'APPROVED',
      areas: [catalog.malolos.id, catalog.meycauayan.id, catalog.sumapangMatanda.id],
      listings: [
        {
          categorySlug: 'plumbing-services',
          title: 'General plumbing repairs',
          description: 'Minor leaks, faucet replacement, and drain cleaning. Parts are quoted separately.',
          startingPrice: 40000,
          priceType: 'STARTING_FROM',
          requiresInspection: true,
        },
        {
          categorySlug: 'electrical-services',
          title: 'Electrical fixture installation',
          description: 'Installation of lights, switches, and outlets. Existing wiring must be checked first.',
          startingPrice: 50000,
          priceType: 'STARTING_FROM',
          requiresInspection: true,
        },
        {
          categorySlug: 'general-maintenance',
          title: 'Small home repairs',
          description: 'Shelves, door hinges, and other small repairs. Describe the job to get a quote.',
          startingPrice: 30000,
          priceType: 'STARTING_FROM',
        },
      ],
    },
    demoPasswordHash,
    categoryIds,
  );

  const wiredWifi = await ensureProvider(
    {
      email: 'provider.wiredwifi@ayosdito.test',
      ownerName: 'Mark Villanueva',
      businessName: 'Wired WiFi Tech',
      description:
        'Home network setup and computer troubleshooting in San Jose del Monte. This demo application is waiting for administrator review.',
      yearsOfExperience: 3,
      approvalStatus: 'PENDING',
      areas: [catalog.sanJoseDelMonte.id],
      listings: [
        {
          categorySlug: 'internet-wifi',
          title: 'Wi-Fi troubleshooting visit',
          description: 'On-site check of router placement, signal, and basic network settings.',
          startingPrice: 50000,
          priceType: 'STARTING_FROM',
        },
        {
          categorySlug: 'laptop-computer-repair',
          title: 'Computer tune-up',
          description: 'Software clean-up and basic hardware check.',
          startingPrice: 45000,
          priceType: 'STARTING_FROM',
        },
      ],
    },
    demoPasswordHash,
    categoryIds,
  );

  await ensureFavorite(maria.id, laptopCare.providerId);
  await ensureFavorite(carlo.id, homeFix.providerId);

  // A new request waiting for quotes.
  await ensureDemoRequest({
    customerId: maria.id,
    categoryId: categoryIds.get('laptop-computer-repair')!,
    locationId: catalog.guinhawa.id,
    title: 'Laptop sobrang bagal at nagha-hang',
    problemDescription:
      'My laptop became very slow and freezes when I open several applications. I want to know if the storage needs to be replaced.',
    status: 'PENDING',
    daysOld: 2,
  });

  // Two quotes waiting for the customer to compare.
  await ensureDemoRequest({
    customerId: carlo.id,
    categoryId: categoryIds.get('plumbing-services')!,
    locationId: catalog.meycauayan.id,
    title: 'Tumutulo ang gripo sa ilalim ng lababo',
    problemDescription:
      'Water is slowly dripping under the kitchen sink. The cabinet is getting wet. I need someone to check the pipe or the faucet.',
    status: 'RESPONDED',
    daysOld: 3,
    quotes: [
      {
        providerId: homeFix.providerId,
        proposedPrice: 95000,
        priceNotes: 'Includes labor and a standard flexible hose. A different faucet would be quoted separately.',
        estimatedDuration: '1–2 hours',
        status: 'PENDING',
        daysOld: 2,
      },
      {
        providerId: homeWorks.providerId,
        proposedPrice: 75000,
        priceNotes: 'Labor only. Parts will be listed after inspection and need your approval before purchase.',
        estimatedDuration: 'Same day visit',
        status: 'PENDING',
        daysOld: 1,
      },
    ],
  });

  // A quote accepted, but the job has not started yet.
  await ensureDemoRequest({
    customerId: carlo.id,
    categoryId: categoryIds.get('electrical-services')!,
    locationId: catalog.meycauayan.id,
    title: 'Walang kuryente sa kusina',
    problemDescription:
      'The kitchen outlets stopped working after a small spark near one outlet. I am not using them until someone checks the wiring.',
    status: 'ACCEPTED',
    daysOld: 4,
    assignedProviderId: homeWorks.providerId,
    quotes: [
      {
        providerId: homeWorks.providerId,
        proposedPrice: 80000,
        priceNotes: 'Visit and troubleshooting for the kitchen circuit. Replacement outlets, if needed, are extra.',
        estimatedDuration: '1 day',
        status: 'ACCEPTED',
        daysOld: 3,
      },
    ],
  });

  // A job currently in progress.
  await ensureDemoRequest({
    customerId: maria.id,
    categoryId: categoryIds.get('aircon-services')!,
    locationId: catalog.malolos.id,
    title: 'Aircon cleaning bago magtag-init',
    problemDescription:
      'The split-type aircon is not cooling well and there is a slight musty smell. I would like two units cleaned before summer.',
    status: 'IN_PROGRESS',
    daysOld: 6,
    assignedProviderId: coolAir.providerId,
    targetProviderId: null,
    quotes: [
      {
        providerId: coolAir.providerId,
        proposedPrice: 130000,
        priceNotes: 'Cleaning for two split-type units. Additional charge only if a unit needs extra drainage repair.',
        estimatedDuration: 'Half day',
        status: 'ACCEPTED',
        daysOld: 5,
      },
    ],
  });

  // Completed jobs with reviews. They are demo records, clearly tied to demo
  // providers and demo customers so ratings are never presented as real data.
  await ensureDemoRequest({
    customerId: ana.id,
    categoryId: categoryIds.get('laptop-computer-repair')!,
    locationId: catalog.malolos.id,
    title: 'Laptop umiinit at nagsasara mag-isa',
    problemDescription:
      'My laptop heats up and shuts down while I am working on school requirements. I need it checked before the next semester.',
    status: 'COMPLETED',
    daysOld: 50,
    assignedProviderId: laptopCare.providerId,
    completedAt: daysAgo(45),
    quotes: [
      {
        providerId: laptopCare.providerId,
        proposedPrice: 250000,
        priceNotes: 'Thermal cleaning and replacement of thermal paste. Parts will be quoted separately if needed.',
        estimatedDuration: '2 days',
        status: 'ACCEPTED',
        daysOld: 48,
      },
    ],
    review: {
      providerId: laptopCare.providerId,
      rating: 5,
      comment:
        'Malinaw magpaliwanag at hindi nagpalit ng parts nang walang paalam. Umiwas na ulit ang laptop ko. Salamat!',
      daysOld: 44,
      providerResponse:
        'Salamat po! Message lang po kayo kung may iba pang problema sa laptop. Ingat po kayo palagi.',
    },
  });

  await ensureDemoRequest({
    customerId: carlo.id,
    categoryId: categoryIds.get('laptop-computer-repair')!,
    locationId: catalog.meycauayan.id,
    title: 'Nawawala ang tunog ng laptop',
    problemDescription:
      'The laptop speakers suddenly stopped working after an update. Headphones still work. I need help checking whether it is software or hardware.',
    status: 'COMPLETED',
    daysOld: 20,
    assignedProviderId: laptopCare.providerId,
    completedAt: daysAgo(12),
    quotes: [
      {
        providerId: laptopCare.providerId,
        proposedPrice: 90000,
        priceNotes: 'Audio driver check and software fix. If the speaker needs replacement, I will send a separate quote.',
        estimatedDuration: '1 day',
        status: 'ACCEPTED',
        daysOld: 18,
      },
    ],
    review: {
      providerId: laptopCare.providerId,
      rating: 4,
      comment:
        'Naayos agad ang sound settings at pinakita paano i-check kung software ang problema. Punctual at malinaw ang pagpapaliwanag.',
      daysOld: 11,
    },
  });

  await ensureDemoRequest({
    customerId: maria.id,
    categoryId: categoryIds.get('laptop-computer-repair')!,
    locationId: catalog.guinhawa.id,
    title: 'Laptop hindi na mag-on pagkatapos mabagsakan',
    problemDescription:
      'The laptop fell from the table and now does not turn on. There is no visible damage on the screen. I need a diagnosis before deciding on a repair.',
    status: 'COMPLETED',
    daysOld: 7,
    assignedProviderId: laptopCare.providerId,
    completedAt: daysAgo(3),
    quotes: [
      {
        providerId: laptopCare.providerId,
        proposedPrice: 180000,
        priceNotes: 'Diagnosis and reconnection of the loose internal connector. No replacement parts were needed.',
        estimatedDuration: '1–2 days',
        status: 'ACCEPTED',
        daysOld: 6,
      },
    ],
    review: {
      providerId: laptopCare.providerId,
      rating: 5,
      comment:
        'Nagbigay muna ng diagnosis at presyo bago ayusin. Malinaw at maayos kausap, at gumagana na ulit ang laptop. Highly recommended.',
      daysOld: 2,
    },
  });

  await ensureDemoRequest({
    customerId: carlo.id,
    categoryId: categoryIds.get('plumbing-services')!,
    locationId: catalog.camalig.id,
    title: 'Baradong lababo sa banyo',
    problemDescription:
      'The bathroom sink drains very slowly and sometimes overflows. I tried a plunger but the water still goes down slowly.',
    status: 'COMPLETED',
    daysOld: 35,
    assignedProviderId: homeFix.providerId,
    completedAt: daysAgo(30),
    quotes: [
      {
        providerId: homeFix.providerId,
        proposedPrice: 130000,
        priceNotes: 'Drain cleaning and checking of the trap. No new parts were needed.',
        estimatedDuration: '2 hours',
        status: 'ACCEPTED',
        daysOld: 33,
      },
    ],
    review: {
      providerId: homeFix.providerId,
      rating: 5,
      comment:
        'Maagang dumating at nilinis ang lababo. Mahusay at maingat sa bahay. I will contact them again for plumbing work.',
      daysOld: 29,
    },
  });

  console.log('[seed] Demo requests are ready, including a request with competing quotes.');
  console.log('[seed] Demo providers are marked isDemo. Public pages must show that label.');
  console.log('[seed] Demo accounts use DEMO_PASSWORD from server/.env; they are not production users.');
  if (wiredWifi.providerId) {
    console.log('[seed] One demo provider is waiting in the admin approval queue.');
  }
}

async function main() {
  const demoEnabled = config.seedDemoData && !config.isProduction;

  await seedAdmin();
  const catalog = await seedCatalog();
  const categories = await prisma.category.findMany();
  const categoryIds = new Map(categories.map((category) => [category.slug, category.id]));

  if (demoEnabled) {
    await seedDemo(catalog, categoryIds);
    console.log('[seed] Demo data seeding finished.');
  } else {
    console.log('[seed] Demo data skipped. Categories and locations remain available.');
  }
}

main()
  .catch((error) => {
    console.error('[seed] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
