import { randomUUID } from 'crypto';
import slugify from 'slugify';

export default function slug(url: string) {
  if (url) {
    return slugify(url, {
      replacement: '-',
      lower: true,
      strict: true,
      trim: true,
    });
  } else {
    // Set a random UUID if nothing comes. This is unlikely, but...
    return randomUUID();
  }
}
