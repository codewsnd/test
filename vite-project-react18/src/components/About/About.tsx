import React from 'react';
import { Typography, Button, Input, Form } from 'antd';
import SocialIcons from './SocialIcons';

const { Title, Text } = Typography;

const About: React.FC = () => {
  return (
    <div className="min-h-screen bg-white">
      <nav className="h-[164px] bg-white border-b border-gray-200">
        <div className="max-w-[1440px] mx-auto h-full px-[80px] flex items-center justify-between">
          <Text className="text-xl font-medium text-black">Site name</Text>
          <div className="flex items-center gap-12">
            <Text className="text-base text-black">Page</Text>
            <Text className="text-base text-black">Page</Text>
            <Text className="text-base text-black">Page</Text>
            <Button type="primary" className="bg-black h-[52px] px-6">
              <Text className="text-white">Button</Text>
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-[1440px] mx-auto px-[80px]">
        <div className="flex gap-8 py-16">
          <div className="flex-1">
            <Title level={1} className="text-5xl font-bold text-black mb-6">About</Title>
            <Text className="block text-xl text-gray-500 mb-6">
              Subheading for description or instructions
            </Text>
            <Text className="block text-base text-black leading-relaxed">
              Body text for your whole article or post. We'll put in some lorem ipsum to show how a filled-out page might look:
              <br /><br />
              Excepteur efficient emerging, minim veniam anim aute carefully curated Ginza conversation exquisite perfect nostrud nisi intricate Content. Qui  international first-class nulla ut. Punctual adipisicing, essential lovely queen tempor eiusmod irure. Exclusive izakaya charming Scandinavian impeccable aute quality of life soft power pariatur Melbourne occaecat discerning. Qui wardrobe aliquip, et Porter destination Toto remarkable officia Helsinki excepteur Basset hound. Zürich sleepy perfect consectetur.
            </Text>
          </div>
          <div className="w-[508px] h-[657px] bg-gray-100">
            <img 
              src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/c1dac10e-fcb8-4cec-ba44-b2c91c7c1543" 
              alt="About" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <div className="py-16">
          <Title level={2} className="text-4xl font-bold text-black mb-8">Contact me</Title>
          
          <Form layout="vertical" className="max-w-[626px]">
            <div className="flex gap-8 mb-6">
              <Form.Item label={<Text className="text-base text-black">First name</Text>} className="flex-1 mb-0">
                <Input 
                  placeholder="Jane" 
                  className="h-12 px-4" 
                  defaultValue="Jane"
                />
              </Form.Item>
              <Form.Item label={<Text className="text-base text-black">Last name</Text>} className="flex-1 mb-0">
                <Input 
                  placeholder="Smitherton" 
                  className="h-12 px-4" 
                  defaultValue="Smitherton"
                />
              </Form.Item>
            </div>
            <Form.Item label={<Text className="text-base text-black">Email address</Text>} className="mb-6">
              <Input 
                placeholder="email@janesfakedomain.net" 
                className="h-12 px-4" 
                defaultValue="email@janesfakedomain.net"
              />
            </Form.Item>
            <Form.Item label={<Text className="text-base text-black">Your message</Text>} className="mb-6">
              <Input.TextArea 
                placeholder="Enter your question or message" 
                rows={6} 
                className="p-4"
                defaultValue="Enter your question or message"
              />
            </Form.Item>
            <Form.Item className="mb-0">
              <Button type="primary" htmlType="submit" className="w-full h-[62px] bg-black border-black">
                <Text className="text-xl text-white">Submit</Text>
              </Button>
            </Form.Item>
          </Form>
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-[1440px] mx-auto px-[80px] py-16">
          <div className="flex justify-between items-start mb-12">
            <div>
              <Text className="text-2xl font-medium text-black block mb-8">Site name</Text>
              <SocialIcons />
            </div>
            <div className="flex gap-16">
              <div className="flex flex-col gap-6">
                <Text className="text-base font-medium text-black">Topic</Text>
                <Text className="text-base text-gray-500">Page</Text>
                <Text className="text-base text-gray-500">Page</Text>
                <Text className="text-base text-gray-500">Page</Text>
              </div>
              <div className="flex flex-col gap-6">
                <Text className="text-base font-medium text-black">Topic</Text>
                <Text className="text-base text-gray-500">Page</Text>
                <Text className="text-base text-gray-500">Page</Text>
                <Text className="text-base text-gray-500">Page</Text>
              </div>
              <div className="flex flex-col gap-6">
                <Text className="text-base font-medium text-black">Topic</Text>
                <Text className="text-base text-gray-500">Page</Text>
                <Text className="text-base text-gray-500">Page</Text>
                <Text className="text-base text-gray-500">Page</Text>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default About;
