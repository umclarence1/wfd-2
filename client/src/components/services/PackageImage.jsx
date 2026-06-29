import { Link } from 'react-router-dom';
import { getPackageImage } from '../../constants/packageImages';

export default function PackageImage({ category, title, size = 'md', className = '' }) {
  const src = getPackageImage(category);
  if (!src) return null;

  const sizes = {
    sm: 'h-12 w-12',
    md: 'h-16 w-16',
    lg: 'h-24 w-24',
    xl: 'h-32 w-32',
    banner: 'h-20 w-20 sm:h-24 sm:w-24',
  };

  return (
    <img
      src={src}
      alt={title || category}
      className={`rounded-2xl object-cover shadow-md ring-2 ring-gray-200 ${sizes[size] || sizes.md} ${className}`}
      loading="lazy"
    />
  );
}

export function ServiceCard({ title, image, link, desc, layout = 'horizontal' }) {
  const base = 'card-hover group overflow-hidden';

  if (layout === 'vertical') {
    return (
      <Link to={link} className={`${base} block`}>
        <div className="flex flex-col items-center p-6 text-center">
          <div className="rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-200 transition-all duration-300 group-hover:ring-blue-200 group-hover:shadow-sm">
            <img src={image} alt={title} className="h-24 w-24 rounded-xl object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-gray-900 group-hover:text-blue-700">{title}</h3>
          {desc && <p className="mt-2 text-sm text-gray-600">{desc}</p>}
        </div>
      </Link>
    );
  }

  return (
    <Link to={link} className={`${base} flex items-center gap-4`}>
      <div className="rounded-xl bg-gray-50 p-2 ring-1 ring-gray-200 transition-all duration-300 group-hover:ring-blue-200 group-hover:shadow-sm">
        <img src={image} alt={title} className="h-14 w-14 shrink-0 rounded-lg object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
      </div>
      <div>
        <h3 className="font-bold text-gray-900 group-hover:text-blue-700">{title}</h3>
        {desc && <p className="mt-1 text-sm text-gray-600">{desc}</p>}
      </div>
    </Link>
  );
}

export function NetworkTile({ name, image, link }) {
  return (
    <Link
      to={link}
      className="card-hover group flex flex-col items-center gap-3 p-5"
    >
      <div className="rounded-xl bg-gray-50 p-2 ring-1 ring-gray-200 transition-all duration-300 group-hover:ring-blue-200 group-hover:shadow-sm">
        <img src={image} alt={name} className="h-20 w-20 rounded-lg object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
      </div>
      <span className="text-center text-sm font-bold text-gray-900 transition-colors duration-200 group-hover:text-blue-700">{name}</span>
    </Link>
  );
}
