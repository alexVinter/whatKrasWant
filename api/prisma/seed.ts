import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Категории Релиза 1 (порядок и названия — из ТЗ, «Электронные проекты» — рабочее название).
const categories: { name: string; slug: string }[] = [
  { name: 'Благоустройство и общественные пространства', slug: 'blagoustrojstvo-i-obshchestvennye-prostranstva' },
  { name: 'Транспорт и дорожная инфраструктура', slug: 'transport-i-dorozhnaya-infrastruktura' },
  { name: 'Экология', slug: 'ekologiya' },
  { name: 'Социальная сфера', slug: 'socialnaya-sfera' },
  { name: 'Культура', slug: 'kultura' },
  { name: 'Спорт', slug: 'sport' },
  { name: 'Молодёжь', slug: 'molodyozh' },
  { name: 'Волонтёрство и благотворительность', slug: 'volontyorstvo-i-blagotvoritelnost' },
  { name: 'Домашние питомцы', slug: 'domashnie-pitomcy' },
  { name: 'Предпринимательство', slug: 'predprinimatelstvo' },
  { name: 'Парки', slug: 'parki' },
  { name: 'Электронные проекты', slug: 'elektronnye-proekty' },
  { name: 'Другие сферы', slug: 'drugie-sfery' },
];

// Районы Красноярска.
const districts: string[] = [
  'Железнодорожный',
  'Кировский',
  'Ленинский',
  'Октябрьский',
  'Свердловский',
  'Советский',
  'Центральный',
];

// Feature flags. Безопасные значения для закрытого этапа — всё выключено.
const featureFlags: string[] = ['PUBLIC_CATALOG', 'PUBLIC_SUBMISSION', 'VOTING', 'RESULTS'];

// Темы идеи (k400) — пользовательская классификация, отдельно от админ-категорий.
const ideaTopics: { name: string; slug: string }[] = [
  { name: 'Благоустройство', slug: 'improvement' },
  { name: 'Велоинфраструктура', slug: 'bike-infrastructure' },
  { name: 'Детские площадки', slug: 'playgrounds' },
  { name: 'Дороги', slug: 'roads' },
  { name: 'Животные', slug: 'animals' },
  { name: 'Здравоохранение', slug: 'healthcare' },
  { name: 'Мероприятия', slug: 'events' },
  { name: 'Образование', slug: 'education' },
  { name: 'Озеленение', slug: 'landscaping' },
  { name: 'Освещение', slug: 'lighting' },
  { name: 'Остановки', slug: 'bus-stops' },
  { name: 'Парки', slug: 'parks' },
  { name: 'Спорт', slug: 'sport' },
  { name: 'Спортплощадки', slug: 'sports-grounds' },
  { name: 'Строительство', slug: 'construction' },
  { name: 'Транспорт', slug: 'transport' },
  { name: 'Туризм', slug: 'tourism' },
  { name: 'Учреждения', slug: 'institutions' },
  { name: 'Экология', slug: 'ecology' },
];

async function main() {
  for (let i = 0; i < categories.length; i++) {
    const { name, slug } = categories[i];
    await prisma.category.upsert({
      where: { slug },
      update: { name, sortOrder: i + 1 },
      create: { name, slug, sortOrder: i + 1 },
    });
  }

  for (let i = 0; i < districts.length; i++) {
    const name = districts[i];
    await prisma.district.upsert({
      where: { name },
      update: { sortOrder: i + 1 },
      create: { name, sortOrder: i + 1 },
    });
  }

  for (let i = 0; i < ideaTopics.length; i++) {
    const { name, slug } = ideaTopics[i];
    await prisma.ideaTopic.upsert({
      where: { slug },
      update: { name, sortOrder: i + 1 },
      create: { name, slug, sortOrder: i + 1 },
    });
  }

  for (const key of featureFlags) {
    // update:{} — не перезаписываем уже существующее значение при повторном запуске.
    await prisma.systemSetting.upsert({
      where: { key },
      update: {},
      create: { key, value: false },
    });
  }

  const [categoryCount, districtCount, ideaTopicCount, settingCount] = await Promise.all([
    prisma.category.count(),
    prisma.district.count(),
    prisma.ideaTopic.count(),
    prisma.systemSetting.count(),
  ]);

  console.log(
    `Seed complete: categories=${categoryCount}, districts=${districtCount}, ideaTopics=${ideaTopicCount}, systemSettings=${settingCount}`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
