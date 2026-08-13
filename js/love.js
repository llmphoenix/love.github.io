const words = [
    '愛', '爱', 'Love', 'Amour', 'Liebe', 'Amore',
    'Amor', 'Любовь', 'الحب', 'प्यार', 'Cinta',
    'Αγάπη', '사랑', 'Liefde', 'Dashuri', 'Каханне',
    'Ljubav', 'Láska', 'Armastus', 'Mahal', 'אהבה', 
    'Szerelem', 'Grá', 'Mīlestība', 'Meilė', 'Любов', 
    'Љубовта', 'Cinta', 'عشق', 'Dragoste', 'Láska', 
    'Renmen', 'ፍቅር', 'munaña', 'Sevgi', 'Љубав', 
    'karout', 'amà', 'amôr', 'kærleiki', 'mborayhu', 
    'Upendo', 'sòòyayyàà', 'ljubav', 'Սեր', 'сүю', 
    'сүйүү', 'tia', 'aroha', 'KHAIR', 'प्रेम', 
    'kjærlighet', 'munay', 'jecel', 'Kärlek', 'soymek', 
    'Mahal', 'ярату', 'محبت', 'sopp', 'uthando', 
    'ความรัก', 'Aşk', 'Tình yêu', 'ליבע'];

d3.select('.love')
    .style('--particles', words.length)
    .selectAll('span')
    .data(words)
    .enter()
    .append('span')
    .style('--n', (d, i) => i + 1)
    .text((d) => d)
    .classed('lit', (d, i) => i % 5 === 0)   /* 标记：该词的"爱"作为醒目高亮点（淡化边框模式下） */
    .style('--lit-delay', (d, i, nodes) => {
        /* 与基础散布相位错开 2.5s，并把高亮词均匀铺满 20s 周期，
           让"接力变实"沿心形轮廓均匀滑动 */
        const n = nodes.length;
        return `${-(2.5 + (i * 20) / n)}s`;
    });
